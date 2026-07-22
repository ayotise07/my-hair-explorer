import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/server/admin";

// Stripe webhook — the source of truth for online payments.
// Register https://<your-domain>/api/stripe-webhook in the Stripe dashboard
// with events: checkout.session.completed, checkout.session.expired,
// and put the signing secret in STRIPE_WEBHOOK_SECRET.

export async function POST(request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whSecret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const stripe = new Stripe(key);
  const payload = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, request.headers.get("stripe-signature"), whSecret);
  } catch (err) {
    console.error("webhook signature:", err.message);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const session = event.data.object;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return NextResponse.json({ received: true });
  const bookingRef = adminDb.doc(`bookings/${bookingId}`);

  if (event.type === "checkout.session.completed" && session.payment_status === "paid") {
    const snap = await bookingRef.get();
    if (snap.exists && snap.data().status === "awaiting-checkout") {
      await bookingRef.update({
        status: "deposit-paid",
        payment: {
          provider: "stripe",
          sessionId: session.id,
          paymentIntent: session.payment_intent || null,
          amount: (session.amount_total || 0) / 100,
          paidAt: new Date(),
        },
      });
    }
  }

  if (event.type === "checkout.session.expired") {
    // Abandoned checkout: free the held slots.
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists || snap.data().status !== "awaiting-checkout") return;
      for (const id of snap.data().slotIds || []) tx.delete(adminDb.doc(`slots/${id}`));
      tx.delete(bookingRef);
    });
  }

  return NextResponse.json({ received: true });
}
