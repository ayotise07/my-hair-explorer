// Weekly availability. The owner's hours live in Firestore (content/schedule,
// edited under Admin → Availability); every function here takes that schedule
// object. Bookable start times are generated every 90 minutes inside each
// day's window, and a style is only offered if it finishes by closing time.

export const SLOT_INTERVAL_MIN = 90;

// Matches the studio's original hours: closed Thursdays & Sundays.
export const DEFAULT_SCHEDULE = {
  days: {
    0: { open: false, start: "8:00 AM", end: "6:00 PM" }, // Sun
    1: { open: true, start: "8:00 AM", end: "6:00 PM" },
    2: { open: true, start: "8:00 AM", end: "6:00 PM" },
    3: { open: true, start: "8:00 AM", end: "6:00 PM" },
    4: { open: false, start: "8:00 AM", end: "6:00 PM" }, // Thu
    5: { open: true, start: "8:00 AM", end: "6:00 PM" },
    6: { open: true, start: "8:00 AM", end: "6:00 PM" },
  },
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function timeToMinutes(time) {
  const m = String(time).match(/(\d+):(\d+) (AM|PM)/);
  if (!m) return 0;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

export function minutesToTime(mins) {
  const h24 = Math.floor(mins / 60);
  const mm = String(mins % 60).padStart(2, "0");
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${suffix}`;
}

function dayRule(schedule, dateStr) {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return schedule?.days?.[dow] || DEFAULT_SCHEDULE.days[dow];
}

export function isOpen(schedule, dateStr) {
  return !!dayRule(schedule, dateStr).open;
}

// All start times the day offers (ignoring bookings): every 90 minutes from
// opening, keeping at least an hour before closing.
export function daySlots(schedule, dateStr) {
  const rule = dayRule(schedule, dateStr);
  if (!rule.open) return [];
  const start = timeToMinutes(rule.start);
  const end = timeToMinutes(rule.end);
  const out = [];
  for (let m = start; m + 60 <= end; m += SLOT_INTERVAL_MIN) out.push(minutesToTime(m));
  return out;
}

export function nextOpenDays(schedule, count = 14) {
  const days = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // bookings start tomorrow
  while (days.length < count) {
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      day: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      num: d.getDate(),
      open: isOpen(schedule, iso),
      label: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      short: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Start times a booking occupies: every offered start in [start, start + hours).
// An 8:00 AM 5-hr set covers 8:00, 9:30 and 11:00 — a slot starting exactly
// when it ends stays bookable.
export function coveredSlots(schedule, dateStr, time, hours) {
  const start = timeToMinutes(time);
  const end = start + (hours || 1) * 60;
  return daySlots(schedule, dateStr).filter((s) => {
    const m = timeToMinutes(s);
    return m >= start && m < end;
  });
}

// Start times where a booking of `hours` fits entirely: it must finish by
// closing, and every slot it covers must be free.
export function freeSlotsForDuration(schedule, dateStr, takenIds, hours = 1) {
  const rule = dayRule(schedule, dateStr);
  if (!rule.open) return [];
  const closing = timeToMinutes(rule.end);
  return daySlots(schedule, dateStr).filter((s) => {
    if (timeToMinutes(s) + (hours || 1) * 60 > closing) return false;
    return coveredSlots(schedule, dateStr, s, hours).every((c) => !takenIds.has(`${dateStr}_${c}`));
  });
}

// "9:30 AM" + 5 hrs -> "~2:30 PM"
export function doneBy(time, hours) {
  return `~${minutesToTime(timeToMinutes(time) + (hours || 1) * 60)}`;
}
