"use client";

import { useEffect, useState } from "react";
import { saveSchedule } from "@/lib/admin-data";
import { fetchSchedule } from "@/lib/data";
import { daySlots, minutesToTime, timeToMinutes, WEEKDAYS } from "@/lib/schedule";

// Half-hour choices from 6:00 AM to 10:00 PM for open/close selects.
const TIME_OPTIONS = [];
for (let m = 6 * 60; m <= 22 * 60; m += 30) TIME_OPTIONS.push(minutesToTime(m));

// Preview slots for a weekday rule without needing a concrete date.
function ruleSlots(rule) {
  if (!rule.open) return [];
  return daySlots({ days: { 0: rule, 1: rule, 2: rule, 3: rule, 4: rule, 5: rule, 6: rule } }, "2026-01-04");
}

export default function AdminAvailability() {
  const [saved, setSaved] = useState(null);
  const [days, setDays] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSchedule()
      .then((s) => {
        setSaved(s.days);
        setDays(s.days);
      })
      .catch(console.error);
  }, []);

  if (!days) return <p>Loading…</p>;

  const dirty = JSON.stringify(days) !== JSON.stringify(saved);

  function set(dow, patch) {
    setDays((d) => ({ ...d, [dow]: { ...d[dow], ...patch } }));
  }

  async function publish() {
    setError("");
    for (const dow of Object.keys(days)) {
      const r = days[dow];
      if (r.open && timeToMinutes(r.end) - timeToMinutes(r.start) < 60) {
        setError(`${WEEKDAYS[dow]}: the window needs at least an hour between opening and closing.`);
        return;
      }
    }
    await saveSchedule({ days });
    setSaved(days);
    setToast("Hours published — the booking flow uses them right away.");
    setTimeout(() => setToast(""), 2500);
  }

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1>Availability</h1>
        <p className="sub" style={{ margin: "4px 0 0", fontSize: 14.5, color: "var(--taupe)" }}>
          Your weekly hours. Start times are offered every 90 minutes, and a style only shows if it
          finishes by closing. For one-off days off, use Bookings → Block time off.
        </p>
      </div>

      <div className="admin-table">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
          const rule = days[dow];
          const slots = ruleSlots(rule);
          return (
            <div
              key={dow}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 90px 1fr",
                gap: 14,
                alignItems: "start",
                padding: "14px 20px",
                borderBottom: "1px solid rgba(61,43,31,.08)",
              }}
            >
              <strong style={{ fontSize: 15.5, paddingTop: 8 }}>{WEEKDAYS[dow]}</strong>
              <div style={{ paddingTop: 4 }}>
                <button
                  role="switch"
                  aria-checked={rule.open}
                  aria-label={`Open on ${WEEKDAYS[dow]}`}
                  className="switch"
                  onClick={() => set(dow, { open: !rule.open })}
                >
                  <span className="knob" />
                </button>
              </div>
              {rule.open ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      aria-label={`${WEEKDAYS[dow]} opening time`}
                      value={rule.start}
                      onChange={(e) => set(dow, { start: e.target.value })}
                      style={{ border: "1.5px solid rgba(61,43,31,.2)", borderRadius: 8, padding: "9px 10px", fontSize: 14.5, fontFamily: "var(--sans)", background: "#fdfbf6", minHeight: 40 }}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <span style={{ color: "var(--taupe)" }}>to</span>
                    <select
                      aria-label={`${WEEKDAYS[dow]} closing time`}
                      value={rule.end}
                      onChange={(e) => set(dow, { end: e.target.value })}
                      style={{ border: "1.5px solid rgba(61,43,31,.2)", borderRadius: 8, padding: "9px 10px", fontSize: 14.5, fontFamily: "var(--sans)", background: "#fdfbf6", minHeight: 40 }}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--taupe)" }}>
                    {slots.length ? `Start times: ${slots.join(" · ")}` : "Window too short for any start time."}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 14.5, color: "var(--taupe)", paddingTop: 8 }}>Closed</span>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="error-box">{error}</div>}
      {dirty && (
        <div className="savebar">
          <span className="msg">
            <strong>Unsaved hours</strong> — existing appointments are never moved by hour changes.
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setDays(saved)}>
              Discard
            </button>
            <button className="btn btn-bronze" onClick={publish}>
              Publish hours
            </button>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
