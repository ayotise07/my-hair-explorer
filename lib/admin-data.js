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
import { coveredSlots, daySlots, DEFAULT_SCHEDULE, isOpen } from "./schedule";
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

// Weekly hours (content/schedule) — read via fetchSchedule in lib/data.
export async function saveSchedule(schedule) {
  await setDoc(doc(db, "content", "schedule"), schedule);
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

// Every slot id a booking occupies. Bookings that predate multi-slot claims
// only ever created their single start marker, so that is all we free —
// recomputing coverage could delete markers now owned by other bookings.
function bookingSlotIds(booking) {
  if (booking.slotIds?.length) return booking.slotIds;
  return [slotId(booking.date, booking.time)];
}

export async function setBookingStatus(booking, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, "bookings", booking.id), { status });
  if (status === "cancelled") {
    // free every public slot marker the booking held
    for (const id of bookingSlotIds(booking)) {
      batch.delete(doc(db, "slots", id));
    }
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

// Block every slot on every open day in [fromIso, toIso]. Slots that are
// already booked or blocked are left untouched (the transaction reads first),
// so a vacation block never clobbers an existing appointment's marker.
export async function blockDateRange(schedule, fromIso, toIso) {
  const dates = [];
  const d = new Date(fromIso + "T00:00:00");
  const end = new Date(toIso + "T00:00:00");
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (isOpen(schedule, iso)) dates.push(iso);
    d.setDate(d.getDate() + 1);
    if (dates.length > 60) throw new Error("That range is too long — block up to ~2 months at a time.");
  }
  if (dates.length === 0) throw new Error("No open days in that range.");
  const pairs = dates.flatMap((date) => daySlots(schedule, date).map((time) => ({ date, time })));
  let created = 0;
  await runTransaction(db, async (tx) => {
    const refs = pairs.map((p) => doc(db, "slots", slotId(p.date, p.time)));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    created = 0;
    snaps.forEach((s, i) => {
      if (!s.exists()) {
        tx.set(refs[i], { ...pairs[i], status: "blocked", createdAt: serverTimestamp() });
        created++;
      }
    });
  });
  return { days: dates.length, created };
}

// Remove every *blocked* marker on a day (booked markers stay).
export async function unblockDay(dateIso) {
  const snap = await getDocs(
    query(collection(db, "slots"), where("date", "==", dateIso), where("status", "==", "blocked"))
  );
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

// Admin-made booking: same multi-slot claim as the public flow.
export async function adminCreateBooking({ schedule, service, date, time, client, phone, notes }) {
  const bookingRef = doc(collection(db, "bookings"));
  const cover = coveredSlots(schedule, date, time, service.hours);
  const slotIds = cover.map((t) => slotId(date, t));
  await runTransaction(db, async (tx) => {
    const refs = slotIds.map((id) => doc(db, "slots", id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    if (snaps.some((s) => s.exists()))
      throw new Error("That time overlaps an existing booking or blocked slot.");
    refs.forEach((r, i) =>
      tx.set(r, { date, time: cover[i], status: "booked", createdAt: serverTimestamp() })
    );
    tx.set(bookingRef, {
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      hours: service.hours,
      price: service.price,
      deposit: service.deposit,
      date,
      time,
      slotIds,
      client,
      phone,
      notes: notes || "",
      status: "confirmed",
      createdAt: serverTimestamp(),
    });
  });
}

// Move a booking: claim every slot the new time covers, free the old ones,
// update the booking — atomically, so the old slots never free unless the
// new ones are secured.
export async function rescheduleBooking(schedule, booking, date, time) {
  const oldIds = bookingSlotIds(booking);
  const cover = coveredSlots(schedule, date, time, booking.hours);
  const newIds = cover.map((t) => slotId(date, t));
  await runTransaction(db, async (tx) => {
    const refs = newIds.map((id) => doc(db, "slots", id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    snaps.forEach((s, i) => {
      // the booking's own current slots don't count as conflicts
      if (s.exists() && !oldIds.includes(newIds[i]))
        throw new Error("That time overlaps an existing booking or blocked slot.");
    });
    for (const id of oldIds) tx.delete(doc(db, "slots", id));
    refs.forEach((r, i) =>
      tx.set(r, { date, time: cover[i], status: "booked", createdAt: serverTimestamp() })
    );
    tx.update(doc(db, "bookings", booking.id), { date, time, slotIds: newIds, status: "confirmed" });
  });
}

// ── Seed import ──

export async function importStarterContent(onProgress = () => {}) {
  onProgress("Writing content, services, FAQs and reviews…");
  const batch = writeBatch(db);
  batch.set(doc(db, "content", "site"), SEED_CONTENT);
  batch.set(doc(db, "content", "schedule"), DEFAULT_SCHEDULE);
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
