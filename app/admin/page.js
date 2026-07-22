"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAllBookings,
  fetchAllPhotos,
  fetchAllReviews,
  fetchAllServices,
  fetchContentDoc,
  importStarterContent,
} from "@/lib/admin-data";

const BADGE = {
  confirmed: ["badge badge-confirmed", "Confirmed"],
  "deposit-paid": ["badge badge-deposit", "Paid online"],
  "payment-pending": ["badge badge-reschedule", "Payment pending"],
  "awaiting-checkout": ["badge badge-cancelled", "Awaiting card payment"],
  "reschedule-requested": ["badge badge-reschedule", "Reschedule req."],
  cancelled: ["badge badge-cancelled", "Cancelled"],
};

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [seeding, setSeeding] = useState("");

  async function load() {
    const [content, bookings, reviews, services, photos] = await Promise.all([
      fetchContentDoc(),
      fetchAllBookings(),
      fetchAllReviews(),
      fetchAllServices(),
      fetchAllPhotos(),
    ]);
    setData({ content, bookings, reviews, services, photos });
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function seed() {
    try {
      await importStarterContent(setSeeding);
      await load();
    } catch (err) {
      console.error(err);
      setSeeding(`Import failed: ${err.message}`);
    }
  }

  if (!data) return <p>Loading…</p>;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const active = data.bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "awaiting-checkout"
  );
  const upcoming = active
    .filter((b) => b.date >= todayIso)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const thisWeek = active.filter((b) => b.date >= weekStartIso && b.date < weekEndIso);

  const month = todayIso.slice(0, 7);
  const revenue = active
    .filter((b) => b.date.startsWith(month))
    .reduce((sum, b) => {
      const m = String(b.price).match(/\d+/);
      return sum + (m ? parseInt(m[0], 10) : 0);
    }, 0);
  const deposits = upcoming
    .filter((b) => b.status === "deposit-paid" || b.payment)
    .reduce((sum, b) => sum + (b.payment?.amount ?? b.deposit ?? 0), 0);

  const published = data.reviews.filter((r) => r.status === "published");
  const pending = data.reviews.filter((r) => r.status === "pending");
  const avgRating = published.length
    ? (published.reduce((s, r) => s + r.stars, 0) / published.length).toFixed(1)
    : "—";

  const noPhoto = data.services.filter((s) => s.visible && !s.image);
  const reschedules = upcoming.filter((b) => b.status === "reschedule-requested");
  const todayCount = active.filter((b) => b.date === todayIso).length;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <div>
        <h1>{greeting}, Temmie</h1>
        <p className="sub" style={{ margin: "4px 0 0", fontSize: 14.5, color: "var(--taupe)" }}>
          {dateLabel} — you have {todayCount} appointment{todayCount === 1 ? "" : "s"} today.
        </p>
      </div>

      {!data.content && (
        <div className="new-item-box">
          <strong className="section-label">FRESH PROJECT</strong>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)", lineHeight: 1.6 }}>
            Firestore is empty. Import the starter content — services, FAQs, reviews and photos — to
            light up the site, then edit everything from here.
          </p>
          {seeding && <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{seeding}</p>}
          <button className="btn btn-bronze" style={{ alignSelf: "flex-start" }} onClick={seed} disabled={!!seeding && !seeding.startsWith("Import failed")}>
            Import starter content
          </button>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">BOOKINGS THIS WEEK</div>
          <div className="v">{thisWeek.length}</div>
          <div className="d">{upcoming.length} upcoming total</div>
        </div>
        <div className="stat-card">
          <div className="k">REVENUE · {now.toLocaleDateString("en-US", { month: "long" }).toUpperCase()}</div>
          <div className="v">${revenue.toLocaleString()}</div>
          <div className="d">${deposits} collected online</div>
        </div>
        <div className="stat-card">
          <div className="k">AVERAGE RATING</div>
          <div className="v">
            {avgRating}
            <span className="star"> ★</span>
          </div>
          <div className="d">
            {pending.length} new review{pending.length === 1 ? "" : "s"} to approve
          </div>
        </div>
        <div className="stat-card">
          <div className="k">SERVICES LIVE</div>
          <div className="v">{data.services.filter((s) => s.visible).length}</div>
          <div className="d">{data.photos.length} photos in the library</div>
        </div>
      </div>

      <div className="overview-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="panel" style={{ gap: 4 }}>
          <div className="panel-head">
            <strong className="section-label">NEXT APPOINTMENTS</strong>
            <Link href="/admin/bookings" className="aside-link">
              All bookings →
            </Link>
          </div>
          {upcoming.length === 0 && (
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)", padding: "12px 0" }}>
              No upcoming appointments yet — new bookings from the site will show up here.
            </p>
          )}
          {upcoming.slice(0, 5).map((b) => {
            const d = new Date(b.date + "T00:00:00");
            const day =
              b.date === todayIso
                ? "TODAY"
                : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
            const [cls, label] = BADGE[b.status] || BADGE.confirmed;
            return (
              <div className="appt-row" key={b.id}>
                <div className="when">
                  <div className="d">{day}</div>
                  <div className="t">{b.time.replace(/ (AM|PM)/, "")}</div>
                </div>
                <div className="who">
                  <strong>{b.client}</strong>
                  <div className="s">
                    {b.serviceName} · {b.duration}
                  </div>
                </div>
                <span className={cls}>{label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="panel">
            <strong className="section-label">NEEDS YOUR ATTENTION</strong>
            {pending.length > 0 && (
              <Link href="/admin/reviews" className="attn-link">
                <span>
                  {pending.length} review{pending.length === 1 ? "" : "s"} awaiting approval
                </span>
                <span className="arrow">→</span>
              </Link>
            )}
            {noPhoto.slice(0, 2).map((s) => (
              <Link href="/admin/services" className="attn-link" key={s.id}>
                <span>{s.name} has no photo</span>
                <span className="arrow">→</span>
              </Link>
            ))}
            {reschedules.map((b) => (
              <Link href="/admin/bookings" className="attn-link" key={b.id}>
                <span>1 reschedule request from {b.client}</span>
                <span className="arrow">→</span>
              </Link>
            ))}
            {pending.length === 0 && noPhoto.length === 0 && reschedules.length === 0 && (
              <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)" }}>All clear — nothing waiting on you.</p>
            )}
          </div>
          <div className="panel-dark">
            <strong className="section-label">QUICK ACTIONS</strong>
            <div className="quick-actions">
              <Link href="/admin/bookings">Block time off</Link>
              <Link href="/admin/photos">Upload photos</Link>
              <Link href="/admin/content">Edit announcement</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
