import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/server/admin";
import { coveredSlots, DEFAULT_SCHEDULE } from "@/lib/schedule";

// Stripe Checkout for online deposits. Flow:
//   POST   -> claim slots + create an `awaiting-checkout` booking + Checkout URL
//   GET    -> after redirect back: verify the session, mark booking paid
//   DELETE -> customer backed out: free the slots if still pending
// The webhook (app/api/stripe-webhook) is the source of truth for completed
// and expired sessions; GET/DELETE just make the UX immediate.

const CHECKOUT_TTL_MIN = 30;

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

async function loadSchedule() {
  const snap = await adminDb.doc("content/schedule").get();
  if (!snap.exists) return DEFAULT_SCHEDULE;
  const data = snap.data();
  return { ...data, days: { ...DEFAULT_SCHEDULE.days, ...(data.days || {}) } };
}

export async function POST(request) {
  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Online payment isn't set up yet." }, { status: 503 });
  }
  const { serviceId, date, time, name, phone, notes } = await request.json();
  if (
    typeof name !== "string" || !name.trim() || name.length > 120 ||
    typeof phone !== "string" || !phone.trim() || phone.length > 40 ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(date)) ||
    !/^[0-9]{1,2}:[0-9]{2} (AM|PM)$/.test(String(time))
  ) {
    return NextResponse.json({ error: "Missing or invalid booking details." }, { status: 400 });
  }

  const svcSnap = await adminDb.doc(`services/${serviceId}`).get();
  if (!svcSnap.exists || !svcSnap.data().visible) {
    return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  }
  const service = svcSnap.data();
  if (!service.deposit || service.deposit <= 0) {
    return NextResponse.json({ error: "This style has no online deposit — pay in person instead." }, { status: 400 });
  }

  const schedule = await loadSchedule();
  const cover = coveredSlots(schedule, date, time, service.hours);
  if (!cover.includes(time)) {
    return NextResponse.json({ error: "That start time isn't offered on that day." }, { status: 400 });
  }
  const slotIds = cover.map((t) => `${date}_${t}`);
  const bookingRef = adminDb.collection("bookings").doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      const refs = slotIds.map((id) => adminDb.doc(`slots/${id}`));
      const snaps = await tx.getAll(...refs);
      if (snaps.some((s) => s.exists)) {
        const err = new Error("That time was just taken — pick another.");
        err.code = "slot-taken";
        throw err;
      }
      const now = new Date();
      refs.forEach((r, i) => tx.set(r, { date, time: cover[i], status: "booked", createdAt: now }));
      tx.set(bookingRef, {
        serviceId,
        serviceName: service.name,
        duration: service.duration,
        hours: service.hours,
        price: service.price,
        deposit: service.deposit,
        date,
        time,
        slotIds,
        client: name.trim(),
        phone: phone.trim(),
        notes: (notes || "").slice(0, 1000),
        status: "awaiting-checkout",
        paymentMethod: "online",
        createdAt: now,
      });
    });
  } catch (err) {
    if (err.code === "slot-taken") return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_MIN * 60,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: service.deposit * 100,
          product_data: {
            name: `Deposit — ${service.name}`,
            description: `${date} at ${time} with Temmie. Deposit goes toward your $${service.priceFrom} total.`,
          },
        },
      },
    ],
    metadata: { bookingId: bookingRef.id },
    success_url: `${origin}/book?paid=1&bid=${bookingRef.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book?cancelled=1&bid=${bookingRef.id}`,
  });

  await bookingRef.update({ stripeSessionId: session.id });
  return NextResponse.json({ url: session.url, bookingId: bookingRef.id });
}

// Verify after the success redirect; idempotent with the webhook.
export async function GET(request) {
  const stripe = stripeClient();
  const url = new URL(request.url);
  const bid = url.searchParams.get("bid");
  const sessionId = url.searchParams.get("session_id");
  if (!stripe || !bid || !sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }
  const bookingRef = adminDb.doc(`bookings/${bid}`);
  const snap = await bookingRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const booking = snap.data();
  if (booking.stripeSessionId !== sessionId) {
    return NextResponse.json({ error: "Session mismatch." }, { status: 400 });
  }
  if (booking.status === "awaiting-checkout") {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await bookingRef.update({
        status: "deposit-paid",
        payment: {
          provider: "stripe",
          sessionId,
          amount: booking.deposit,
          paidAt: new Date(),
        },
      });
      booking.status = "deposit-paid";
    } else {
      return NextResponse.json({ error: "Payment not completed yet." }, { status: 402 });
    }
  }
  const { client, ...rest } = booking;
  return NextResponse.json({ id: bid, client, ...rest, createdAt: undefined });
}

// Customer cancelled checkout: free the slots while it's still pending.
export async function DELETE(request) {
  const { bid } = await request.json();
  if (!bid) return NextResponse.json({ error: "Missing booking." }, { status: 400 });
  const bookingRef = adminDb.doc(`bookings/${bid}`);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) return;
    const booking = snap.data();
    if (booking.status !== "awaiting-checkout") return; // paid or handled — leave it
    for (const id of booking.slotIds || []) tx.delete(adminDb.doc(`slots/${id}`));
    tx.delete(bookingRef);
  });
  return NextResponse.json({ ok: true });
}
