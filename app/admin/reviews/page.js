"use client";

import { useEffect, useState } from "react";
import { fetchAllReviews, setReviewFeatured, setReviewStatus } from "@/lib/admin-data";

function Stars({ n }) {
  return <span className="stars">{"★".repeat(n) + "☆".repeat(5 - n)}</span>;
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchAllReviews().then(setReviews).catch(console.error);
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function act(review, action) {
    if (action === "feature") {
      const featured = reviews.filter((r) => r.featured && r.id !== review.id);
      if (featured.length >= 3) {
        notify("Up to 3 featured reviews — unfeature one first.");
        return;
      }
      await setReviewFeatured(review.id, true);
    }
    if (action === "unfeature") await setReviewFeatured(review.id, false);
    if (action === "approve") await setReviewStatus(review.id, "published");
    if (action === "hide") await setReviewStatus(review.id, "hidden");
    setReviews(await fetchAllReviews());
    if (action === "approve") notify(`${review.name}'s review is now on the site.`);
    if (action === "hide") notify("Review hidden.");
  }

  if (!reviews) return <p>Loading…</p>;

  const pending = reviews.filter((r) => r.status === "pending");
  const published = reviews.filter((r) => r.status === "published");
  const featuredCount = published.filter((r) => r.featured).length;

  return (
    <div style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1>Reviews</h1>
        <p className="sub" style={{ margin: "4px 0 0", fontSize: 14.5, color: "var(--taupe)" }}>
          Approve new reviews and pick up to 3 to feature on the homepage.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="pending-box">
          <strong className="section-label">AWAITING APPROVAL · {pending.length}</strong>
          {pending.map((r) => (
            <div className="review-mod-row" key={r.id}>
              <div className="body">
                <div className="meta">
                  <strong>{r.name}</strong>
                  <Stars n={r.stars} />
                  <span className="when">{r.when}</span>
                </div>
                <p className="quote">“{r.quote}”</p>
              </div>
              <div className="acts">
                <button className="btn btn-green btn-sm" onClick={() => act(r, "approve")}>
                  Approve
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => act(r, "hide")}>
                  Hide
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <strong className="section-label">
          PUBLISHED · {published.length} <span style={{ color: "var(--taupe)", letterSpacing: 0 }}>({featuredCount}/3 featured)</span>
        </strong>
        {published.map((r) => (
          <div className="review-mod-row published" key={r.id}>
            <div className="body">
              <div className="meta">
                <strong>{r.name}</strong>
                <Stars n={r.stars} />
                <span className="when">{r.service}</span>
              </div>
              <p className="quote">“{r.quote}”</p>
            </div>
            <button
              className={`feat-btn${r.featured ? " on" : ""}`}
              onClick={() => act(r, r.featured ? "unfeature" : "feature")}
            >
              {r.featured ? "★ Featured" : "Feature"}
            </button>
          </div>
        ))}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
