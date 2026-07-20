"use client";

import { useEffect, useState } from "react";
import { fetchAllPhotos, fetchContentDoc, saveContent, swapPhotoOrder } from "@/lib/admin-data";
import { FALLBACK_CONTENT } from "@/lib/seed-data";

export default function AdminContent() {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [heroPhotos, setHeroPhotos] = useState([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchContentDoc()
      .then((c) => {
        const content = c || FALLBACK_CONTENT;
        setSaved(content);
        setForm(content);
      })
      .catch(console.error);
    fetchAllPhotos()
      .then((ps) => setHeroPhotos(ps.filter((p) => p.placements?.includes("Hero"))))
      .catch(console.error);
  }, []);

  if (!form) return <p>Loading…</p>;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function moveHeroPhoto(index, dir) {
    await swapPhotoOrder(heroPhotos[index], heroPhotos[index + dir]);
    const ps = await fetchAllPhotos();
    setHeroPhotos(ps.filter((p) => p.placements?.includes("Hero")));
  }

  async function publish() {
    await saveContent(form);
    setSaved(form);
    setToast("Published — the homepage is updated.");
    setTimeout(() => setToast(""), 2500);
  }

  const previewParts = form.headline.split("|");

  return (
    <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1>Homepage content</h1>
          <p className="sub" style={{ margin: "4px 0 0", fontSize: 14.5, color: "var(--taupe)" }}>
            Edit the words and photos on your homepage — the preview updates as you type.
          </p>
        </div>

        <div className="editor-card">
          <strong className="section-label">HERO</strong>
          <label className="field">
            Headline <span className="opt">(wrap a word in | pipes | to make it bronze italic)</span>
            <input
              type="text"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </label>
          <label className="field">
            Subline
            <textarea
              rows={2}
              value={form.subline}
              onChange={(e) => setForm({ ...form, subline: e.target.value })}
            />
          </label>
          <label className="field">
            Announcement bar <span className="opt">(optional — shows above the header)</span>
            <input
              type="text"
              placeholder="e.g. Away Aug 4–11 — book before or after!"
              value={form.announcement}
              onChange={(e) => setForm({ ...form, announcement: e.target.value })}
            />
          </label>
        </div>

        <div className="editor-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong className="section-label">HERO PHOTOS</strong>
            <span style={{ fontSize: 13, color: "var(--taupe)" }}>Use the arrows to reorder — first photo is the big arch</span>
          </div>
          <div className="hero-photo-strip">
            {heroPhotos.map((p, i) => (
              <div className="slot-img" key={p.id}>
                <img src={p.src} alt={`Hero photo ${i + 1}`} />
                <span className="n">{i + 1}</span>
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 6 }}>
                  <button className="reorder-btn" aria-label="Move earlier" disabled={i === 0} onClick={() => moveHeroPhoto(i, -1)}>
                    ←
                  </button>
                  <button
                    className="reorder-btn"
                    aria-label="Move later"
                    disabled={i === heroPhotos.length - 1}
                    onClick={() => moveHeroPhoto(i, 1)}
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
            <a href="/admin/photos" className="upload-tile" style={{ width: 110, height: 130, textDecoration: "none" }}>
              <span className="plus">+</span>Upload
            </a>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--taupe)" }}>
            Tip: portrait photos in natural light work best. Minimum 800px wide.
          </p>
        </div>

        {dirty && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setForm(saved)}>
              Discard
            </button>
            <button className="btn btn-bronze" onClick={publish}>
              Publish changes
            </button>
          </div>
        )}
      </div>

      <aside style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="Live preview">
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.18em", color: "var(--bronze)" }}>
          LIVE PREVIEW · MOBILE
        </span>
        <div className="mobile-preview">
          {form.announcement ? <div className="p-announce">{form.announcement}</div> : null}
          <div className="p-head">
            <span className="p-mark">
              My Hair Explorer<span style={{ color: "var(--copper)" }}>.</span>
            </span>
            <span className="p-burger">
              <span />
              <span />
              <span />
            </span>
          </div>
          <div className="p-body">
            <span className="p-eyebrow">{form.location?.replace(", MD", "")}</span>
            <span className="p-headline">
              {previewParts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : p))}
            </span>
            {heroPhotos[0] ? <img src={heroPhotos[0].src} alt="" /> : null}
            <span className="p-cta">Book your style</span>
          </div>
        </div>
      </aside>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
