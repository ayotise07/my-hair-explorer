"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
import { slotId } from "./data";
import {
  SEED_CONTENT,
  SEED_FAQS,
  SEED_PHOTOS,
  SEED_REVIEWS,
  SEED_SERVICES,
} from "./seed-data";

// ── Services ──

export async function fetchAllServices() {
  const snap = await getDocs(query(collection(db, "services"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateServices(updates) {
  const batch = writeBatch(db);
  for (const { id, ...patch } of updates) {
    batch.update(doc(db, "services", id), patch);
  }
  await batch.commit();
}

// Create (id == null) or update a service with a full field set.
export async function saveService(id, data) {
  if (id) {
    await updateDoc(doc(db, "services", id), data);
    return id;
  }
  const ref_ = doc(collection(db, "services"));
  await setDoc(ref_, { bookingsThisMonth: 0, ...data });
  return ref_.id;
}

export async function deleteService(id) {
  await deleteDoc(doc(db, "services", id));
}

// ── Content ──

export async function fetchContentDoc() {
  const snap = await getDoc(doc(db, "content", "site"));
  return snap.exists() ? snap.data() : null;
}

export async function saveContent(content) {
  await setDoc(doc(db, "content", "site"), content, { merge: true });
}

// ── FAQs ──

export async function fetchAllFaqs() {
  const snap = await getDocs(query(collection(db, "faqs"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addFaq(q, a, order) {
  await setDoc(doc(collection(db, "faqs")), { q, a, order });
}

export async function updateFaq(id, patch) {
  await updateDoc(doc(db, "faqs", id), patch);
}

export async function deleteFaq(id) {
  await deleteDoc(doc(db, "faqs", id));
}

export async function swapFaqOrder(a, b) {
  const batch = writeBatch(db);
  batch.update(doc(db, "faqs", a.id), { order: b.order });
  batch.update(doc(db, "faqs", b.id), { order: a.order });
  await batch.commit();
}

// ── Reviews ──

export async function fetchAllReviews() {
  const snap = await getDocs(collection(db, "reviews"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setReviewStatus(id, status) {
  await updateDoc(doc(db, "reviews", id), { status });
}

export async function setReviewFeatured(id, featured) {
  await updateDoc(doc(db, "reviews", id), { featured });
}

// ── Photos (Storage + Firestore) ──

export async function fetchAllPhotos() {
  const snap = await getDocs(collection(db, "photos"));
  const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  photos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return photos;
}

export async function uploadPhoto(file, order) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const docRef = doc(collection(db, "photos"));
  const path = `photos/${docRef.id}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const src = await getDownloadURL(storageRef);
  await setDoc(docRef, {
    name: safeName,
    src,
    path,
    placements: [],
    order,
    createdAt: serverTimestamp(),
  });
}

export async function updatePhoto(id, patch) {
  await updateDoc(doc(db, "photos", id), patch);
}

export async function swapPhotoOrder(a, b) {
  const batch = writeBatch(db);
  batch.update(doc(db, "photos", a.id), { order: b.order ?? 0 });
  batch.update(doc(db, "photos", b.id), { order: a.order ?? 0 });
  await batch.commit();
}

export async function deletePhoto(photo) {
  await deleteDoc(doc(db, "photos", photo.id));
  if (photo.path) {
    try {
      await deleteObject(ref(storage, photo.path));
    } catch (err) {
      // doc is gone either way; a missing storage object is fine
      console.warn("storage delete:", err);
    }
  }
}

// ── Bookings & slots ──

export async function fetchBookingsFrom(dateIso) {
  const snap = await getDocs(
    query(collection(db, "bookings"), where("date", ">=", dateIso), orderBy("date"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllBookings() {
  const snap = await getDocs(collection(db, "bookings"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setBookingStatus(booking, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, "bookings", booking.id), { status });
  if (status === "cancelled") {
    // free the public slot marker
    batch.delete(doc(db, "slots", slotId(booking.date, booking.time)));
  }
  await batch.commit();
}

export async function fetchSlotsForDates(fromDate, toDate) {
  const snap = await getDocs(
    query(collection(db, "slots"), where("date", ">=", fromDate), where("date", "<=", toDate))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function blockSlot(date, time) {
  await setDoc(doc(db, "slots", slotId(date, time)), {
    date,
    time,
    status: "blocked",
    createdAt: serverTimestamp(),
  });
}

export async function unblockSlot(id) {
  await deleteDoc(doc(db, "slots", id));
}

// Admin-made booking: same slot-claim transaction as the public flow.
export async function adminCreateBooking({ service, date, time, client, phone, notes }) {
  const bookingRef = doc(collection(db, "bookings"));
  const slotRef = doc(db, "slots", slotId(date, time));
  await runTransaction(db, async (tx) => {
    const slot = await tx.get(slotRef);
    if (slot.exists()) throw new Error("That slot is already taken.");
    tx.set(slotRef, { date, time, status: "booked", createdAt: serverTimestamp() });
    tx.set(bookingRef, {
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      hours: service.hours,
      price: service.price,
      deposit: service.deposit,
      date,
      time,
      client,
      phone,
      notes: notes || "",
      status: "confirmed",
      createdAt: serverTimestamp(),
    });
  });
}

// Move a booking: claim the new slot, free the old one, update the booking —
// atomically, so the old slot never frees unless the new one is secured.
export async function rescheduleBooking(booking, date, time) {
  await runTransaction(db, async (tx) => {
    const newSlotRef = doc(db, "slots", slotId(date, time));
    const slot = await tx.get(newSlotRef);
    if (slot.exists()) throw new Error("That slot is already taken.");
    tx.delete(doc(db, "slots", slotId(booking.date, booking.time)));
    tx.set(newSlotRef, { date, time, status: "booked", createdAt: serverTimestamp() });
    tx.update(doc(db, "bookings", booking.id), { date, time, status: "confirmed" });
  });
}

// ── Seed import ──

export async function importStarterContent(onProgress = () => {}) {
  onProgress("Writing content, services, FAQs and reviews…");
  const batch = writeBatch(db);
  batch.set(doc(db, "content", "site"), SEED_CONTENT);
  for (const { id, ...svc } of SEED_SERVICES) {
    batch.set(doc(db, "services", id), svc);
  }
  SEED_FAQS.forEach((f) => batch.set(doc(collection(db, "faqs")), f));
  SEED_REVIEWS.forEach((r) =>
    batch.set(doc(collection(db, "reviews")), { ...r, createdAt: serverTimestamp() })
  );
  await batch.commit();

  for (const p of SEED_PHOTOS) {
    onProgress(`Uploading ${p.name}…`);
    const res = await fetch(p.local);
    const blob = await res.blob();
    const docRef = doc(collection(db, "photos"));
    const path = `photos/${docRef.id}-${p.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: blob.type });
    const src = await getDownloadURL(storageRef);
    await setDoc(docRef, {
      name: p.name,
      src,
      path,
      placements: p.placements,
      order: p.order,
      createdAt: serverTimestamp(),
    });
  }
  onProgress("Done — starter content imported.");
}
