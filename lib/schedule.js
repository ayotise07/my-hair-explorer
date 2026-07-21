// Studio schedule: base start times, closed Thursdays & Sundays.
export const BASE_SLOTS = ["8:00 AM", "9:30 AM", "11:00 AM", "1:00 PM", "3:00 PM"];
export const CLOSED_DAYS = [0, 4]; // Sun, Thu

export function isOpen(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return !CLOSED_DAYS.includes(d.getDay());
}

export function nextOpenDays(count = 14) {
  const days = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // bookings start tomorrow
  while (days.length < count) {
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      day: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      num: d.getDate(),
      open: isOpen(iso),
      label: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      short: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Free start times for a date given the set of taken slot ids ("date_time").
export function freeSlots(dateStr, takenIds) {
  if (!isOpen(dateStr)) return [];
  return BASE_SLOTS.filter((s) => !takenIds.has(`${dateStr}_${s}`));
}

// Base slots a booking occupies: every start time in [start, start + hours).
// An 8:00 AM 5-hr set covers 8:00, 9:30 and 11:00 — 1:00 PM starts exactly
// as the chair frees up, so it stays bookable.
export function coveredSlots(time, hours) {
  const start = timeToMinutes(time);
  const end = start + (hours || 1) * 60;
  return BASE_SLOTS.filter((s) => {
    const m = timeToMinutes(s);
    return m >= start && m < end;
  });
}

// Start times where a booking of `hours` fits entirely: every slot it would
// cover must be free.
export function freeSlotsForDuration(dateStr, takenIds, hours = 1) {
  if (!isOpen(dateStr)) return [];
  return BASE_SLOTS.filter((s) =>
    coveredSlots(s, hours).every((c) => !takenIds.has(`${dateStr}_${c}`))
  );
}

// "9:30 AM" + 5 hrs -> "~2:30 PM"
export function doneBy(time, hours) {
  const m = time.match(/(\d+):(\d+) (AM|PM)/);
  if (!m) return "";
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === "PM") h += 12;
  h += hours;
  const mins = m[2];
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  let out = h % 12;
  if (out === 0) out = 12;
  return `~${out}:${mins} ${suffix}`;
}

export function timeToMinutes(time) {
  const m = time.match(/(\d+):(\d+) (AM|PM)/);
  if (!m) return 0;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}
