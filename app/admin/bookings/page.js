"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminCreateBooking,
  blockDateRange,
  blockSlot as blockSlotDoc,
  fetchAllBookings,
  fetchAllServices,
  fetchSlotsForDates,
  rescheduleBooking,
  setBookingStatus,
  unblockDay,
  unblockSlot,
} from "@/lib/admin-data";
import { fetchSchedule, fetchTakenSlots } from "@/lib/data";
import {
  daySlots,
  freeSlotsForDuration,
  isOpen,
  nextOpenDays,
  timeToMinutes,
} from "@/lib/schedule";

const BADGE = {
  confirmed: ["badge badge-confirmed", "Confirmed"],
  "deposit-paid": ["badge badge-deposit", "Paid online"],
  "payment-pending": ["badge badge-reschedule", "Payment pending"],
  "awaiting-checkout": ["badge badge-cancelled", "Awaiting card payment"],
  "reschedule-requested": ["badge badge-reschedule", "Reschedule req."],
  cancelled: ["badge badge-cancelled", "Cancelled"],
};

function iso(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  x.setHours(0, 0, 0, 0);
  return x;
}

// Date + time picker over the next 3 weeks of open days. Only offers start
// times where a booking of `hours` fits entirely in free slots.
function SlotPicker({ schedule, date, time, onPick, hours = 1, excludeSlotIds = [] }) {
  const days = useMemo(() => nextOpenDays(schedule, 21).filter((d) => d.open), [schedule]);
  const [taken, setTaken] = useState(null);
  const excludeKey = excludeSlotIds.join(",");

  useEffect(() => {
    fetchTakenSlots(days[0].date, days[days.length - 1].date)
      .then((t) => {
        // a booking's own current slots stay pickable when rescheduling
        for (const id of excludeKey.split(",")) t.delete(id);
        setTaken(t);
      })
      .catch(console.error);
  }, [days, excludeKey]);

  const options = taken
    ? days.map((d) => ({ ...d, slots: freeSlotsForDuration(schedule, d.date, taken, hours) }))
    : [];
  const selected = options.find((d) => d.date === date);

  if (!taken) return <p style={{ margin: 0, color: "var(--taupe)", fontSize: 14 }}>Loading availability…</p>;

  return (
    <div className="modal-row">
      <label className="field">
        Date
        <select
          value={date || ""}
          onChange={(e) => onPick(e.target.value, null)}
        >
          <option value="" disabled>
            Pick a day
          </option>
          {options
            .filter((d) => d.slots.length > 0)
            .map((d) => (
              <option key={d.date} value={d.date}>
                {d.short}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Time
        <select
          value={time || ""}
          onChange={(e) => onPick(date, e.target.value)}
          disabled={!selected}
        >
          <option value="" disabled>
            {selected ? "Pick a time" : "Pick a day first"}
          </option>
          {(selected?.slots || []).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function AddBookingModal({ schedule, services, onClose, onDone }) {
  const [form, setForm] = useState({ client: "", phone: "", notes: "", serviceId: services[0]?.id, date: null, time: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const service = services.find((s) => s.id === form.serviceId);
    if (!form.client.trim() || !form.phone.trim() || !service || !form.date || !form.time) {
      setError("Client, phone, service, date and time are all needed.");
      return;
    }
    setBusy(true);
    try {
      await adminCreateBooking({
        schedule,
        service,
        date: form.date,
        time: form.time,
        client: form.client.trim(),
        phone: form.phone.trim(),
        notes: form.notes,
      });
      onDone(`${form.client.trim()} booked for ${form.time}.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't save the booking.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Add booking">
        <h2>Add booking</h2>
        <div className="modal-row">
          <label className="field">
            Client name
            <input type="text" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </label>
          <label className="field">
            Phone
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
        </div>
        <label className="field">
          Service
          <select
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value, time: null })}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.price} · {s.duration}
              </option>
            ))}
          </select>
        </label>
        <SlotPicker
          schedule={schedule}
          date={form.date}
          time={form.time}
          hours={services.find((s) => s.id === form.serviceId)?.hours}
          onPick={(date, time) => setForm({ ...form, date, time })}
        />
        <label className="field">
          Notes <span className="opt">(optional)</span>
          <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        {error && <div className="error-box">{error}</div>}
        <div className="modal-acts">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-bronze" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Add booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockTimeModal({ schedule, onClose, onDone }) {
  const todayIso = iso(new Date());
  const [mode, setMode] = useState("days"); // 'days' | 'slot'
  const [pick, setPick] = useState({ date: null, time: null });
  const [range, setRange] = useState({ from: "", to: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setBusy(true);
    try {
      if (mode === "slot") {
        if (!pick.date || !pick.time) throw new Error("Pick a day and time to block.");
        await blockSlotDoc(pick.date, pick.time);
        onDone(`${pick.time} blocked off — clients can't book it.`);
        return;
      }
      const from = range.from;
      const to = range.to || range.from;
      if (!from) throw new Error("Pick at least a starting day.");
      if (to < from) throw new Error("The end day is before the start day.");
      if (from < todayIso) throw new Error("That range starts in the past.");
      const { days } = await blockDateRange(schedule, from, to);
      onDone(`${days} day${days === 1 ? "" : "s"} blocked off — clients can't book them.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't block that time.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Block time off">
        <h2>Block time off</h2>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)" }}>
          Blocked times disappear from the public booking flow. Unblock them any time from the day view.
        </p>
        <div style={{ display: "flex", gap: 8 }} role="tablist" aria-label="What to block">
          <button
            role="tab"
            aria-selected={mode === "days"}
            className={`chip${mode === "days" ? " active" : ""}`}
            style={{ minHeight: 40, padding: "9px 18px", fontSize: 13.5 }}
            onClick={() => setMode("days")}
          >
            Whole days
          </button>
          <button
            role="tab"
            aria-selected={mode === "slot"}
            className={`chip${mode === "slot" ? " active" : ""}`}
            style={{ minHeight: 40, padding: "9px 18px", fontSize: 13.5 }}
            onClick={() => setMode("slot")}
          >
            Single time slot
          </button>
        </div>
        {mode === "days" ? (
          <>
            <div className="modal-row">
              <label className="field">
                First day off
                <input
                  type="date"
                  min={todayIso}
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                />
              </label>
              <label className="field">
                Last day off <span className="opt">(leave empty for one day)</span>
                <input
                  type="date"
                  min={range.from || todayIso}
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                />
              </label>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--taupe)" }}>
              Every open day in the range is fully blocked — existing appointments are untouched, so
              cancel or reschedule those separately.
            </p>
          </>
        ) : (
          <SlotPicker
            schedule={schedule}
            date={pick.date}
            time={pick.time}
            onPick={(date, time) => setPick({ date, time })}
          />
        )}
        {error && <div className="error-box">{error}</div>}
        <div className="modal-acts">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-bronze" onClick={save} disabled={busy}>
            {busy ? "Blocking…" : "Block it off"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ schedule, booking, onClose, onDone }) {
  const [pick, setPick] = useState({ date: booking.date, time: booking.time });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!pick.date || !pick.time) {
      setError("Pick the new day and time.");
      return;
    }
    setBusy(true);
    try {
      await rescheduleBooking(schedule, booking, pick.date, pick.time);
      onDone(`${booking.client} moved to ${pick.time}.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Couldn't reschedule.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Reschedule ${booking.client}`}>
        <h2>Reschedule {booking.client}</h2>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)" }}>
          {booking.serviceName} — currently {booking.date} · {booking.time}.
        </p>
        <SlotPicker
          schedule={schedule}
          date={pick.date}
          time={pick.time}
          hours={booking.hours}
          onPick={(date, time) => setPick({ date, time })}
          excludeSlotIds={
            booking.slotIds?.length ? booking.slotIds : [`${booking.date}_${booking.time}`]
          }
        />
        {error && <div className="error-box">{error}</div>}
        <div className="modal-acts">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-bronze" onClick={save} disabled={busy}>
            {busy ? "Moving…" : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [services, setServices] = useState([]);
  const [weekSlots, setWeekSlots] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState(() => iso(new Date()));
  const [modal, setModal] = useState(null); // 'add' | 'block' | booking object
  const [toast, setToast] = useState("");

  const reload = useCallback(async () => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const [b, slots] = await Promise.all([
      fetchAllBookings(),
      fetchSlotsForDates(iso(weekStart), iso(weekEnd)),
    ]);
    setBookings(b);
    setWeekSlots(slots);
  }, [weekStart]);

  useEffect(() => {
    reload().catch(console.error);
    fetchSchedule().then(setSchedule).catch(console.error);
    fetchAllServices().then((s) => setServices(s.filter((x) => x.visible))).catch(console.error);
  }, [reload]);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function closeModal(msg) {
    setModal(null);
    if (msg) {
      await reload();
      notify(msg);
    }
  }

  const week = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dateIso = iso(d);
      const closed = schedule ? !isOpen(schedule, dateIso) : false;
      const count = (bookings || []).filter((b) => b.date === dateIso && b.status !== "cancelled").length;
      return {
        date: dateIso,
        day: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        num: d.getDate(),
        closed,
        count,
        label: closed ? "Closed" : `${count} appt${count === 1 ? "" : "s"}`,
      };
    });
  }, [weekStart, bookings, schedule]);

  const dayBookings = (bookings || [])
    .filter((b) => b.date === selected)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const dayBlocked = weekSlots.filter((s) => s.date === selected && s.status === "blocked");
  // slot markers carry the full duration coverage of each booking
  const takenTimes = new Set(weekSlots.filter((s) => s.date === selected).map((s) => s.time));
  const selectedDate = new Date(selected + "T00:00:00");
  const selectedClosed = schedule ? !isOpen(schedule, selected) : false;
  const dayFree = selectedClosed || !schedule ? [] : daySlots(schedule, selected).filter((s) => !takenTimes.has(s));

  const upcoming = (bookings || []).filter((b) => b.status !== "cancelled" && b.date >= iso(new Date()));
  const deposits = upcoming
    .filter((b) => b.status === "deposit-paid" || b.payment)
    .reduce((s, b) => s + (b.payment?.amount ?? b.deposit ?? 0), 0);

  async function setStatus(booking, status, msg) {
    await setBookingStatus(booking, status);
    await reload();
    notify(msg);
  }

  async function unblock(b) {
    await unblockSlot(b.id);
    await reload();
    notify(`${b.time} is open again.`);
  }

  function shiftWeek(dir) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + dir * 7);
    setWeekStart(next);
  }

  if (!bookings || !schedule) return <p>Loading…</p>;

  const weekLabel = weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const selectedLabel = selectedDate
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Bookings</h1>
          <p className="sub">
            Week of {weekLabel} — {week.reduce((s, d) => s + d.count, 0)} appointments, ${deposits}{" "}
            collected online.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flex: "none" }}>
          <button className="btn btn-outline" onClick={() => setModal("block")}>
            Block time off
          </button>
          <button className="btn btn-bronze" onClick={() => setModal("add")}>
            + Add booking
          </button>
        </div>
      </div>

      <div className="week-strip">
        <button className="week-nav" aria-label="Previous week" onClick={() => shiftWeek(-1)}>
          ←
        </button>
        <div className="week-days">
          {week.map((d) => (
            <button
              key={d.date}
              className={`week-day${d.date === selected ? " selected" : ""}${d.closed ? " closed" : ""}`}
              onClick={() => setSelected(d.date)}
            >
              <div className="d">{d.day}</div>
              <div className="n">{d.num}</div>
              <div className="c">{d.label}</div>
            </button>
          ))}
        </div>
        <button className="week-nav" aria-label="Next week" onClick={() => shiftWeek(1)}>
          →
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <strong className="section-label">
          {selectedLabel} · {dayBookings.filter((b) => b.status !== "cancelled").length} APPOINTMENTS
        </strong>

        {dayBookings.map((b) => {
          const [cls, label] = BADGE[b.status] || BADGE.confirmed;
          const sms = `sms:${b.phone.replace(/\D/g, "")}`;
          return (
            <div className="booking-admin-row" key={b.id}>
              <div>
                <div className="t">{b.time}</div>
                <div className="dur">{b.duration}</div>
              </div>
              <div className="who">
                <strong>{b.client}</strong>
                <div className="s">
                  {b.serviceName}
                  {b.notes ? ` · ${b.notes}` : ""} · {b.phone}
                  {b.paymentMethod === "in-person" ? " · pays Zelle/cash at visit" : ""}
                  {b.paymentMethod === "online" && b.payment ? ` · $${b.payment.amount} paid by card` : ""}
                </div>
              </div>
              <span className={cls}>{label}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn btn-outline btn-sm" href={sms}>
                  Message
                </a>
                {b.status !== "cancelled" && (
                  <button className="btn btn-outline btn-sm" onClick={() => setModal(b)}>
                    Reschedule
                  </button>
                )}
                {b.status === "payment-pending" && (
                  <button
                    className="btn btn-green btn-sm"
                    onClick={() => setStatus(b, "confirmed", `${b.client} marked paid & confirmed.`)}
                  >
                    Mark paid
                  </button>
                )}
                {b.status !== "cancelled" && b.status !== "confirmed" && b.status !== "payment-pending" && (
                  <button className="btn btn-outline btn-sm" onClick={() => setStatus(b, "confirmed", `${b.client} confirmed.`)}>
                    Confirm
                  </button>
                )}
                {b.status !== "cancelled" && (
                  <button
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => {
                      if (confirm(`Cancel ${b.client}'s ${b.serviceName}?`)) {
                        setStatus(b, "cancelled", "Booking cancelled — the slot is open again.");
                      }
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {dayBlocked.map((b) => (
          <div className="booking-admin-row" key={b.id} style={{ opacity: 0.8 }}>
            <div>
              <div className="t">{b.time}</div>
              <div className="dur">blocked</div>
            </div>
            <div className="who">
              <strong>Time off</strong>
              <div className="s">This slot is hidden from the booking flow.</div>
            </div>
            <span className="badge badge-cancelled">Blocked</span>
            <div>
              <button className="btn btn-outline btn-sm" onClick={() => unblock(b)}>
                Unblock
              </button>
            </div>
          </div>
        ))}
        {dayBlocked.length > 1 && (
          <button
            className="btn btn-outline btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              const n = await unblockDay(selected);
              await reload();
              notify(`${n} blocked slot${n === 1 ? "" : "s"} reopened.`);
            }}
          >
            Unblock whole day
          </button>
        )}

        {selectedClosed ? (
          <div className="free-slot-box">The studio is closed this day.</div>
        ) : dayFree.length > 0 ? (
          <div className="free-slot-box">
            Free: {dayFree.join(" · ")} —{" "}
            <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => setModal("add")}>
              add a booking
            </span>{" "}
            or{" "}
            <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => setModal("block")}>
              block it off
            </span>
          </div>
        ) : (
          <div className="free-slot-box">Fully booked — nice.</div>
        )}
      </div>

      {modal === "add" && (
        <AddBookingModal schedule={schedule} services={services} onClose={() => closeModal()} onDone={closeModal} />
      )}
      {modal === "block" && <BlockTimeModal schedule={schedule} onClose={() => closeModal()} onDone={closeModal} />}
      {modal && typeof modal === "object" && (
        <RescheduleModal schedule={schedule} booking={modal} onClose={() => closeModal()} onDone={closeModal} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
