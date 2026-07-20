"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doneBy, freeSlots, nextOpenDays } from "@/lib/schedule";
import { createBooking, fetchTakenSlots } from "@/lib/data";

const STEPS = ["Style", "Date & time", "Confirm"];

function Thumb({ service, className }) {
  if (service?.image) return <img src={service.image} alt="" className={className} />;
  return <span className={`thumb-ph ${className || ""}`}>photo</span>;
}

export default function BookingFlow({ services, content }) {
  const params = useSearchParams();
  const preselect = params.get("service");
  const [step, setStep] = useState(preselect ? 2 : 1);
  const [serviceId, setServiceId] = useState(
    preselect && services.some((s) => s.id === preselect) ? preselect : services[0]?.id
  );
  const [showAll, setShowAll] = useState(false);
  const [days, setDays] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const selectedDay = useMemo(() => days?.find((d) => d.date === date), [days, date]);
  const tel = content.phone.replace(/\D/g, "");

  const loadAvailability = useCallback(async () => {
    const openDays = nextOpenDays(14);
    const taken = await fetchTakenSlots(openDays[0].date, openDays[openDays.length - 1].date);
    const withSlots = openDays.map((d) => ({
      ...d,
      slots: d.open ? freeSlots(d.date, taken) : [],
    }));
    setDays(withSlots);
    const first = withSlots.find((x) => x.open && x.slots.length);
    if (first) setDate((cur) => cur || first.date);
    return withSlots;
  }, []);

  useEffect(() => {
    loadAvailability().catch((err) => console.error("availability:", err));
  }, [loadAvailability]);

  const popular = showAll ? services : services.slice(0, 3);
  const finish = time && service ? doneBy(time, service.hours) : "";
  const due = service ? Math.max(0, service.priceFrom - service.deposit) : 0;

  async function submit() {
    setError("");
    if (!name.trim() || !phone.trim()) {
      setError("Please add your name and phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await createBooking({
        service,
        date,
        time,
        name: name.trim(),
        phone: phone.trim(),
        notes,
      });
      setBooking(data);
    } catch (err) {
      console.error("booking:", err);
      if (err.code === "slot-taken") {
        setError(err.message);
        await loadAvailability();
        setTime(null);
        setStep(2);
      } else {
        setError("Something went wrong — please try again, or call us.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Confirmation (3b) ── */
  if (booking) {
    const firstName = booking.client.split(" ")[0];
    const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Baltimore%2C%20MD";
    return (
      <main style={{ minHeight: "100vh" }}>
        <div className="confirm-hero">
          <span className="badge" aria-hidden="true">
            ✓
          </span>
          <h1>You&apos;re booked, {firstName}!</h1>
          <p>Confirmation sent to your phone.</p>
        </div>
        <div className="confirm-body">
          <div className="confirm-card">
            <div className="summary-card" style={{ boxShadow: "none", padding: 0 }}>
              <div className="svc">
                <Thumb service={service} />
                <div>
                  <strong>{booking.serviceName}</strong>
                  <div className="sub">with Temmie</div>
                </div>
              </div>
              <div className="summary-rows">
                <div className="row">
                  <span>When</span>
                  <strong>
                    {selectedDay?.short} · {booking.time}
                  </strong>
                </div>
                <div className="row">
                  <span>Done by</span>
                  <strong>{doneBy(booking.time, booking.hours)}</strong>
                </div>
                <div className="row">
                  <span>Paid today</span>
                  <strong className="bronze">${booking.deposit} deposit</strong>
                </div>
                <div className="row">
                  <span>Due at appointment</span>
                  <strong>${Math.max(0, booking.price.match(/\d+/) ? parseInt(booking.price.match(/\d+/)[0], 10) - booking.deposit : 0)}</strong>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              className="btn btn-bronze"
              style={{ flex: 1 }}
              href={`data:text/calendar;charset=utf-8,${encodeURIComponent(
                `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${booking.serviceName} — My Hair Explorer\nDTSTART:${booking.date.replace(/-/g, "")}\nDESCRIPTION:${booking.time} with Temmie\nEND:VEVENT\nEND:VCALENDAR`
              )}`}
              download="my-hair-explorer.ics"
            >
              Add to calendar
            </a>
            <a className="btn btn-outline-bronze" style={{ flex: 1 }} href={mapsUrl} target="_blank" rel="noreferrer">
              Get directions
            </a>
          </div>
          <div className="confirm-card">
            <strong style={{ fontSize: 15 }}>Before you come</strong>
            <ul>
              <li>Wash &amp; deep-condition 1–2 days before</li>
              <li>Arrive with hair blow-dried and detangled</li>
              <li>Extension hair is included for this style</li>
              <li>Bring a snack — you&apos;ll be here {booking.duration}</li>
            </ul>
          </div>
          <p className="confirm-foot">
            Need to change plans? <a href={`tel:${tel}`}>Reschedule free</a> up to 48 hrs before.
            <br />
            Questions? {content.phone}
          </p>
          <Link href="/" className="text-link" style={{ justifyContent: "center" }}>
            Back to the site
          </Link>
        </div>
      </main>
    );
  }

  const stepTitle = ["Choose your style", "Pick a date & time", "Your details"][step - 1];
  const stepLede = [
    "Prices include a consultation, parting and finishing oil.",
    service ? `${service.name} takes ${service.duration} — mornings are recommended.` : "",
    "Almost done — a small deposit secures your slot.",
  ][step - 1];

  return (
    <main className="booking-shell" style={{ minHeight: "100vh" }}>
      <header className="booking-header">
        <Link href="/" className="wordmark" style={{ fontSize: 24 }}>
          My Hair Explorer<span className="dot">.</span>
        </Link>
        <div className="booking-progress" aria-label="Booking progress">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const cls = n < step ? "done" : n === step ? "current" : "";
            return (
              <span key={label} style={{ display: "contents" }}>
                {i > 0 && <span className={`bar${n <= step ? " done" : ""}`} />}
                <span className={`step ${cls}`}>
                  <span className="bubble">{n < step ? "✓" : n}</span>
                  {label}
                </span>
              </span>
            );
          })}
        </div>
        <a href={`tel:${tel}`} className="help-link">
          Need help? {content.phone}
        </a>
      </header>

      <div className="booking-grid">
        <div className="booking-main">
          <div>
            <div className="progress-dashes" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= step ? "done" : ""} />
              ))}
            </div>
            <p className="section-label" style={{ margin: "14px 0 4px" }}>
              STEP {step} OF 3
            </p>
            <h1>{stepTitle}</h1>
            {stepLede && <p className="lede">{stepLede}</p>}
          </div>

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {popular.map((s) => (
                <button
                  key={s.id}
                  className={`style-option${s.id === serviceId ? " selected" : ""}`}
                  onClick={() => setServiceId(s.id)}
                  aria-pressed={s.id === serviceId}
                >
                  <Thumb service={s} />
                  <span className="info">
                    <strong>{s.name}</strong>
                    <span className="sub" style={{ display: "block" }}>
                      {s.duration} · {s.price}
                    </span>
                  </span>
                  {s.id === serviceId && <span className="check">✓</span>}
                </button>
              ))}
              {!showAll && services.length > 3 && (
                <button
                  className="text-link"
                  style={{ background: "none", border: "none", cursor: "pointer", justifyContent: "center", color: "var(--bronze)" }}
                  onClick={() => setShowAll(true)}
                >
                  Show all {services.length} services
                </button>
              )}
              <button className="btn btn-bronze btn-lg btn-block" onClick={() => setStep(2)} disabled={!service}>
                Continue — pick a time
              </button>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="day-row">
                {(days || []).slice(0, 7).map((d) => (
                  <button
                    key={d.date}
                    className={`day-cell${d.date === date ? " selected" : ""}${!d.open || !d.slots.length ? " closed" : ""}`}
                    disabled={!d.open || !d.slots.length}
                    onClick={() => {
                      setDate(d.date);
                      setTime(null);
                    }}
                  >
                    <div className="dow">{d.day}</div>
                    <div className="num">{d.num}</div>
                  </button>
                ))}
              </div>
              {!days && <p className="lede">Loading availability…</p>}
              {selectedDay && (
                <div>
                  <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 15, color: "var(--taupe)" }}>
                    {selectedDay.label} — available start times
                  </p>
                  <div className="slot-grid">
                    {selectedDay.slots.map((s) => (
                      <button key={s} className={`slot${s === time ? " selected" : ""}`} onClick={() => setTime(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {time && service && (
                <div className="tip-box">
                  ⏱ Starting at {time}, plan to be done by about <strong>{finish.replace("~", "")}</strong>.
                </div>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button className="btn btn-bronze btn-lg" style={{ flex: 1 }} onClick={() => setStep(3)} disabled={!time}>
                  Continue — your details
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
              <label className="field">
                Full name
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="field">
                Phone
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </label>
              <label className="field">
                Notes for Temmie <span className="opt">(optional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sensitive edges, bringing my own hair…"
                />
              </label>
              {error && <div className="error-box">{error}</div>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <button className="btn btn-bronze btn-lg" style={{ flex: 1 }} onClick={submit} disabled={submitting}>
                  {submitting
                    ? "Confirming…"
                    : service?.deposit
                      ? `Pay $${service.deposit} deposit & confirm`
                      : "Confirm booking"}
                </button>
              </div>
              <p className="fine" style={{ margin: 0, fontSize: 13, color: "var(--taupe)", textAlign: "center" }}>
                Free reschedule up to 48 hrs before. Deposit goes toward your total.
              </p>
            </div>
          )}
        </div>

        <aside className="booking-aside" aria-label="Booking summary">
          {service && (
            <div className="summary-card">
              <span className="label">YOUR BOOKING</span>
              <div className="svc">
                <Thumb service={service} />
                <div>
                  <strong>{service.name}</strong>
                  <div className="sub">
                    {service.duration} · with Temmie
                  </div>
                </div>
              </div>
              <div className="summary-rows">
                <div className="row">
                  <span>Date</span>
                  <strong>{selectedDay ? selectedDay.short : "—"}</strong>
                </div>
                <div className="row">
                  <span>Time</span>
                  <strong>{time || "—"}</strong>
                </div>
                <div className="row">
                  <span>Price</span>
                  <strong>{service.price}</strong>
                </div>
                <div className="row">
                  <span>Deposit today</span>
                  <strong className="bronze">${service.deposit}</strong>
                </div>
              </div>
              <p className="fine">Free reschedule up to 48 hrs before.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
