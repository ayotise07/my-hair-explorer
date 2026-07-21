"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { FALLBACK_CONTENT } from "./seed-data";
import { coveredSlots } from "./schedule";

export function slotId(date, time) {
  return `${date}_${time}`;
}

// ── Public reads (shaped to satisfy the security rules' query filters) ──

export async function fetchContent() {
  const snap = await getDoc(doc(db, "content", "site"));
  return snap.exists() ? snap.data() : FALLBACK_CONTENT;
}

export async function fetchVisibleServices() {
  const q = query(collection(db, "services"), where("visible", "==", true), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchFaqs() {
  const snap = await getDocs(query(collection(db, "faqs"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchFeaturedReviews() {
  const q = query(
    collection(db, "reviews"),
    where("status", "==", "published"),
    where("featured", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 3);
}

export async function fetchPhotos() {
  const snap = await getDocs(collection(db, "photos"));
  const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  photos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return photos;
}

// Taken slots (booked or blocked) in a date range — PII-free public data.
export async function fetchTakenSlots(fromDate, toDate) {
  const q = query(
    collection(db, "slots"),
    where("date", ">=", fromDate),
    where("date", "<=", toDate)
  );
  const snap = await getDocs(q);
  const taken = new Set();
  snap.forEach((d) => taken.add(d.id));
  return taken;
}

// Atomically claim every slot the booking's duration covers, then store the
// booking. Slot doc ids are "<date>_<time>", so overlapping bookings can
// never coexist: the second transaction sees a covered slot exists and
// aborts. An 8:00 AM 5-hr set claims 8:00, 9:30 and 11:00 in one go.
export async function createBooking({ service, date, time, name, phone, notes }) {
  const bookingRef = doc(collection(db, "bookings"));
  const cover = coveredSlots(time, service.hours);
  const slotIds = cover.map((t) => slotId(date, t));
  const booking = {
    serviceId: service.id,
    serviceName: service.name,
    duration: service.duration,
    hours: service.hours,
    price: service.price,
    deposit: service.deposit,
    date,
    time,
    slotIds,
    client: name,
    phone,
    notes: notes || "",
    status: "deposit-paid",
    createdAt: serverTimestamp(),
  };
  await runTransaction(db, async (tx) => {
    const refs = slotIds.map((id) => doc(db, "slots", id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    if (snaps.some((s) => s.exists())) {
      const err = new Error("That time was just taken — pick another.");
      err.code = "slot-taken";
      throw err;
    }
    refs.forEach((r, i) =>
      tx.set(r, { date, time: cover[i], status: "booked", createdAt: serverTimestamp() })
    );
    tx.set(bookingRef, booking);
  });
  return { id: bookingRef.id, ...booking };
}
