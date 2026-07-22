"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doneBy, freeSlotsForDuration, isOpen } from "@/lib/schedule";
import { createBooking, fetchSchedule, fetchTakenSlots } from "@/lib/data";

const STEPS = ["Style", "Date & time", "Confirm"];
const BOOKING_HORIZON_DAYS = 180;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function Thumb({ service, className }) {
  if (service?.image) return <img src={service.image} alt="" className={className} />;
  return <span className={`thumb-ph ${className || ""}`}>photo</span>;
}

function isoPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function lastDayOfMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

function fmtShort(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtLong(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function BookingFlow({ services, content }) {
  const params = useSearchParams();
  const preselect = params.get("service");
  const [step, setStep] = useState(preselect ? 2 : 1);
  const [serviceId, setServiceId] = useState(
    preselect && services.some((s) => s.id === preselect) ? preselect : services[0]?.id
  );
  const [showAll, setShowAll] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [monthKey, setMonthKey] = useState(null); // "2026-07" — calendar page shown
  const [takenSets, setTakenSets] = useState({}); // monthKey -> Set of taken slot ids
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const stripeEnabled = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";
  const [payMethod, setPayMethod] = useState(stripeEnabled ? "online" : "in-person");
  const [finalizing, setFinalizing] = useState(
    () => params.get("paid") === "1" && !!params.get("bid") && !!params.get("session_id")
  );

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const tel = content.phone.replace(/\D/g, "");
  const minIso = useMemo(() => isoPlusDays(1), []); // bookings start tomorrow
  const maxIso = useMemo(() => isoPlusDays(BOOKING_HORIZON_DAYS), []);

  useEffect(() => {
    fetchSchedule().then(setSchedule).catch((err) => console.error("schedule:", err));
  }, []);

  // Returning from Stripe Checkout: verify the session and show the
  // confirmation, or release the held slots if the customer backed out.
  const handledReturn = useRef(false);
  useEffect(() => {
    if (handledReturn.current) return;
    const bid = params.get("bid");
    if (!bid) return;
    handledReturn.current = true;
    const cleanUrl = () => window.history.replaceState(null, "", "/book");
    if (params.get("paid") === "1" && params.get("session_id")) {
      fetch(`/api/checkout?bid=${bid}&session_id=${params.get("session_id")}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "verify failed");
          if (data.serviceId) setServiceId(data.serviceId);
          setBooking(data);
        })
        .catch((err) => {
          console.error("payment verify:", err);
          setError(
            "We couldn't confirm your payment automatically — if you were charged, your spot is safe; call us to double-check."
          );
          setStep(3);
        })
        .finally(() => {
          setFinalizing(false);
          cleanUrl();
        });
    } else if (params.get("cancelled") === "1") {
      fetch("/api/checkout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid }),
      }).catch(() => {});
      setError("Checkout was cancelled — your time was released. Pick a slot to try again.");
      setStep(2);
      cleanUrl();
    }
  }, [params]);

  useEffect(() => {
    if (schedule && !monthKey) setMonthKey(minIso.slice(0, 7));
  }, [schedule, monthKey, minIso]);

  // One availability fetch per displayed month, cached in a ref so the
  // check is synchronous (state updaters run too late for that).
  const takenRef = useRef({});
  const loadMonth = useCallback(async (key, force = false) => {
    if (!key || (!force && takenRef.current[key])) return;
    const t = await fetchTakenSlots(`${key}-01`, lastDayOfMonth(key));
    takenRef.current = { ...takenRef.current, [key]: t };
    setTakenSets(takenRef.current);
  }, []);

  useEffect(() => {
    loadMonth(monthKey).catch((err) => console.error("availability:", err));
  }, [monthKey, loadMonth]);

  // Calendar cells for the shown month. A day is bookable when it's within
  // the horizon, the studio is open, and the chosen style's full duration
  // fits around existing bookings.
  const calendar = useMemo(() => {
    if (!schedule || !monthKey) return null;
    const [y, m] = monthKey.split("-").map(Number);
    const taken = takenSets[monthKey];
    const cells = Array.from({ length: new Date(y, m - 1, 1).getDay() }, () => null);
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
      const inRange = iso >= minIso && iso <= maxIso;
      const slots =
        inRange && taken && isOpen(schedule, iso)
          ? freeSlotsForDuration(schedule, iso, taken, service?.hours)
          : [];
      cells.push({ iso, num: d, bookable: slots.length > 0, slots });
    }
    return cells;
  }, [schedule, monthKey, takenSets, service, minIso, maxIso]);

  const monthLoaded = !!(monthKey && takenSets[monthKey]);

  // Default to the first bookable day; if the whole month is full, page
  // forward automatically until something is free (within the horizon).
  useEffect(() => {
    if (!calendar || !monthLoaded || date) return;
    const first = calendar.find((c) => c?.bookable);
    if (first) {
      setDate(first.iso);
    } else if (monthKey < maxIso.slice(0, 7)) {
      setMonthKey(shiftMonth(monthKey, 1));
    }
  }, [calendar, monthLoaded, date, monthKey, maxIso]);

  // Times for the selected day (may live in a previously loaded month).
  const selectedSlots = useMemo(() => {
    if (!date || !schedule) return [];
    const taken = takenSets[date.slice(0, 7)];
    if (!taken) return [];
    return freeSlotsForDuration(schedule, date, taken, service?.hours);
  }, [date, schedule, takenSets, service]);

  // drop a picked time that stopped fitting (service change, refetch)
  useEffect(() => {
    if (time && date && takenSets[date.slice(0, 7)] && !selectedSlots.includes(time)) setTime(null);
  }, [time, date, takenSets, selectedSlots]);

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
      if (payMethod === "online") {
        // Server claims the slots, then hands off to Stripe Checkout.
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            date,
            time,
            name: name.trim(),
            phone: phone.trim(),
            notes,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            const err = new Error(data.error);
            err.code = "slot-taken";
            throw err;
          }
          throw new Error(data.error || "Checkout failed.");
        }
        window.location.assign(data.url);
        return; // navigating away — keep the spinner up
      }
      const data = await createBooking({
        schedule,
        service,
        date,
        time,
        name: name.trim(),
        phone: phone.trim(),
        notes,
      });
      setBooking(data);
      setSubmitting(false);
    } catch (err) {
      console.error("booking:", err);
      if (err.code === "slot-taken") {
        setError(err.message);
        await loadMonth(date.slice(0, 7), true);
        setTime(null);
        setStep(2);
      } else {
        setError(err.message || "Something went wrong — please try again, or call us.");
      }
      setSubmitting(false);
    }
  }

  /* ── Returning from Stripe: verifying the payment ── */
  if (finalizing) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ textAlign: "center", color: "var(--taupe)" }}>
          <h1 style={{ fontSize: 28, color: "var(--espresso)" }}>Confirming your payment…</h1>
          <p style={{ marginTop: 8 }}>One moment — don&apos;t close this page.</p>
        </div>
      </main>
    );
  }

  /* ── Confirmation (3b) ── */
  if (booking) {
    const firstName = booking.client.split(" ")[0];
    const inPerson = booking.paymentMethod === "in-person";
    const priceNum = String(booking.price).match(/\d+/)
      ? parseInt(String(booking.price).match(/\d+/)[0], 10)
      : 0;
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
                    {fmtShort(booking.date)} · {booking.time}
                  </strong>
                </div>
                <div className="row">
                  <span>Done by</span>
                  <strong>{doneBy(booking.time, booking.hours)}</strong>
                </div>
                {inPerson ? (
                  <>
                    <div className="row">
                      <span>Payment</span>
                      <strong className="bronze">In person — payment pending</strong>
                    </div>
                    <div className="row">
                      <span>Due at appointment</span>
                      <strong>{priceNum ? `$${priceNum}` : booking.price}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="row">
                      <span>Paid today (card)</span>
                      <strong className="bronze">${booking.deposit} deposit</strong>
                    </div>
                    <div className="row">
                      <span>Due at appointment</span>
                      <strong>${Math.max(0, priceNum - booking.deposit)}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {inPerson && (
            <div className="confirm-card" style={{ borderLeft: "3px solid var(--honey)" }}>
              <strong style={{ fontSize: 15 }}>Paying in person</strong>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--taupe)" }}>
                Your appointment is reserved. Payment is collected at the studio —{" "}
                <strong style={{ color: "var(--espresso)" }}>Zelle or cash only</strong>, no cards in
                person.
              </p>
            </div>
          )}
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
    "Almost done — choose how you'd like to pay.",
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
              {calendar ? (
                <div className="cal">
                  <div className="cal-head">
                    <button
                      className="week-nav"
                      aria-label="Previous month"
                      disabled={monthKey <= minIso.slice(0, 7)}
                      onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
                    >
                      ←
                    </button>
                    <strong className="cal-month">{monthLabel(monthKey)}</strong>
                    <button
                      className="week-nav"
                      aria-label="Next month"
                      disabled={monthKey >= maxIso.slice(0, 7)}
                      onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
                    >
                      →
                    </button>
                  </div>
                  <div className="cal-grid">
                    {DOW.map((d, i) => (
                      <span key={i} className="cal-dow" aria-hidden="true">
                        {d}
                      </span>
                    ))}
                    {calendar.map((c, i) =>
                      c === null ? (
                        <span key={`pad-${i}`} />
                      ) : (
                        <button
                          key={c.iso}
                          className={`cal-day${c.iso === date ? " selected" : ""}`}
                          disabled={!c.bookable}
                          aria-label={`${fmtLong(c.iso)}${c.bookable ? "" : " — unavailable"}`}
                          onClick={() => {
                            setDate(c.iso);
                            setTime(null);
                          }}
                        >
                          {c.num}
                        </button>
                      )
                    )}
                  </div>
                  {!monthLoaded && <p className="lede">Checking availability…</p>}
                  {monthLoaded && (
                    <p style={{ margin: 0, fontSize: 13.5, color: "var(--taupe)" }}>
                      Greyed-out days are closed, fully booked, or don&apos;t have a long enough
                      opening for this style{service ? ` (${service.duration})` : ""}.
                    </p>
                  )}
                </div>
              ) : (
                <p className="lede">Loading availability…</p>
              )}
              {date && selectedSlots.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 15, color: "var(--taupe)" }}>
                    {fmtLong(date)} — available start times
                  </p>
                  <div className="slot-grid">
                    {selectedSlots.map((s) => (
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

              <div className="field" role="radiogroup" aria-label="How would you like to pay?">
                How would you like to pay?
                {stripeEnabled && service?.deposit > 0 && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={payMethod === "online"}
                    className={`style-option${payMethod === "online" ? " selected" : ""}`}
                    onClick={() => setPayMethod("online")}
                  >
                    <span className="info">
                      <strong>Pay ${service.deposit} deposit online</strong>
                      <span className="sub" style={{ display: "block", fontWeight: 400 }}>
                        Credit / debit card, secure checkout via Stripe. The rest is due at your
                        appointment.
                      </span>
                    </span>
                    {payMethod === "online" && <span className="check">✓</span>}
                  </button>
                )}
                <button
                  type="button"
                  role="radio"
                  aria-checked={payMethod === "in-person"}
                  className={`style-option${payMethod === "in-person" ? " selected" : ""}`}
                  onClick={() => setPayMethod("in-person")}
                >
                  <span className="info">
                    <strong>Pay in person</strong>
                    <span className="sub" style={{ display: "block", fontWeight: 400 }}>
                      Nothing due now — pay at your appointment. Zelle or cash only.
                    </span>
                  </span>
                  {payMethod === "in-person" && <span className="check">✓</span>}
                </button>
              </div>

              {error && <div className="error-box">{error}</div>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <button className="btn btn-bronze btn-lg" style={{ flex: 1 }} onClick={submit} disabled={submitting}>
                  {submitting
                    ? payMethod === "online"
                      ? "Opening secure checkout…"
                      : "Confirming…"
                    : payMethod === "online"
                      ? `Pay $${service?.deposit} deposit & confirm`
                      : "Reserve — pay in person"}
                </button>
              </div>
              <p className="fine" style={{ margin: 0, fontSize: 13, color: "var(--taupe)", textAlign: "center" }}>
                Free reschedule up to 48 hrs before.
                {payMethod === "online" ? " Deposit goes toward your total." : " In-person payment is Zelle or cash only."}
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
                  <strong>{date ? fmtShort(date) : "—"}</strong>
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
