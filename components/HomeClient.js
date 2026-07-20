"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StickyBookBar from "@/components/StickyBookBar";
import {
  fetchContent,
  fetchFaqs,
  fetchFeaturedReviews,
  fetchPhotos,
  fetchVisibleServices,
} from "@/lib/data";
import { FALLBACK_CONTENT } from "@/lib/seed-data";

function Headline({ headline }) {
  // "|word|" marks the italic bronze emphasis, e.g. "…feels like |you|."
  const parts = headline.split("|");
  return <h1>{parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : p))}</h1>;
}

function Placeholder({ label, light = false, className = "", style }) {
  return (
    <div
      className={`photo-placeholder${light ? " light" : ""} ${className}`}
      style={style}
      role="img"
      aria-label={label}
    >
      [ {label} ]
    </div>
  );
}

// Grid on desktop; on mobile the same markup becomes a swipe carousel (spec 2b)
// with pagination dots tracking scroll position.
function ReviewsSection({ reviews }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.min(reviews.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }

  return (
    <section className="section-white">
      <div className="section-head" style={{ marginBottom: 28 }}>
        <h2>What clients say</h2>
      </div>
      <div className="reviews-grid" ref={trackRef} onScroll={onScroll}>
        {reviews.map((r) => (
          <figure className="review-card" key={r.id}>
            <span className="stars" aria-label={`${r.stars} out of 5 stars`}>
              {"★".repeat(r.stars)}
            </span>
            <blockquote>“{r.quote}”</blockquote>
            <figcaption>
              — {r.name} · {r.service}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="carousel-dots" aria-hidden="true">
        {reviews.map((_, i) => (
          <span key={i} className={i === active ? "on" : ""} />
        ))}
      </div>
    </section>
  );
}

export default function HomeClient() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchContent(),
      fetchVisibleServices(),
      fetchFaqs(),
      fetchFeaturedReviews(),
      fetchPhotos(),
    ])
      .then(([content, services, faqs, reviews, photos]) =>
        setData({ content, services, faqs, reviews, photos })
      )
      .catch((err) => {
        console.error("Failed to load site content:", err);
        setData({ content: FALLBACK_CONTENT, services: [], faqs: [], reviews: [], photos: [] });
      });
  }, []);

  const content = data?.content || FALLBACK_CONTENT;
  const services = data?.services || [];
  const faqs = data?.faqs || [];
  const reviews = data?.reviews || [];
  const photos = data?.photos || [];
  const signatureStyles = content.signatureStyles || [];

  const heroPhotos = photos.filter((p) => p.placements?.includes("Hero"));
  const lookbook = photos.filter((p) => p.placements?.includes("Lookbook"));
  const instagram = photos.filter((p) => p.placements?.includes("Instagram"));

  return (
    <>
      <SiteHeader announcement={content.announcement} />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">{content.location}</span>
            <Headline headline={content.headline} />
            <p className="sub">{content.subline}</p>
            <div className="hero-ctas">
              <Link href="/book" className="btn btn-bronze btn-lg">
                Book your style
              </Link>
              <Link href="/services" className="text-link">
                See pricing
              </Link>
            </div>
            <div className="hero-stats">
              <span>
                <strong>{content.stats?.rating}</strong> client rating
              </span>
              <span>
                <strong>{content.stats?.styles}</strong> styles braided
              </span>
              <span>
                <strong>{services.length || "—"}</strong> services
              </span>
            </div>
          </div>
          <div className="hero-photos">
            {heroPhotos[0] ? (
              <img src={heroPhotos[0].src} alt="Knotless braids, back view" className="arch" />
            ) : (
              <Placeholder label="hero photo" light className="arch" />
            )}
            {heroPhotos[1] ? (
              <img src={heroPhotos[1].src} alt="Waist-length boho braids" className="sq" />
            ) : (
              <Placeholder label="photo" light className="sq" />
            )}
            {heroPhotos[2] ? (
              <img src={heroPhotos[2].src} alt="Half-up half-down ponytail" className="sq-scoop" />
            ) : (
              <Placeholder label="photo" light className="sq-scoop" />
            )}
          </div>
        </section>

        {signatureStyles.length > 0 && (
          <section className="section-dark" id="styles">
            <div className="section-head">
              <h2>Signature styles</h2>
              <Link href="/services" className="aside-link">
                All services &amp; pricing →
              </Link>
            </div>
            <div className="styles-grid">
              {signatureStyles.map((s) => (
                <Link href={`/book?service=${s.serviceId}`} key={s.name} className="style-card">
                  {s.image ? (
                    <img src={s.image} alt={s.name} />
                  ) : (
                    <Placeholder label={`${s.name.toLowerCase()} photo`} style={{ height: 280 }} />
                  )}
                  <div className="meta">
                    <strong>{s.name}</strong>
                    <span>{s.price}</span>
                  </div>
                </Link>
              ))}
            </div>
            <span className="swipe-hint">← swipe →</span>
          </section>
        )}

        <section className="section" id="gallery">
          <div className="section-head">
            <h2>The lookbook</h2>
            <span className="aside-note">Real clients, real styles</span>
          </div>
          <div className="lookbook-grid">
            {Array.from({ length: 6 }).map((_, i) => {
              const p = lookbook[i];
              const tall = i === 0 || i === 2;
              if (!p) return <Placeholder key={i} label="client photo" light className={tall ? "tall" : ""} />;
              return <img key={p.id} src={p.src} alt={p.name.replace(/[-_.]/g, " ")} className={tall ? "tall" : ""} />;
            })}
          </div>
        </section>

        {reviews.length > 0 && <ReviewsSection reviews={reviews} />}

        <section className="faq-section" id="faq">
          <div className="faq-intro">
            <h2>Good to know</h2>
            <p>Everything about prep, timing and policies — so your appointment goes smoothly.</p>
            <Link href="/book" className="btn btn-bronze" style={{ alignSelf: "flex-start", marginTop: 8 }}>
              Book an appointment
            </Link>
          </div>
          <div className="faq-list">
            {faqs.map((f) => (
              <details key={f.id}>
                <summary>
                  {f.q}
                  <span className="plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section-dark">
          <div className="section-head" style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 32 }}>{content.instagram}</h2>
            <a
              className="aside-link"
              href={`https://instagram.com/${(content.instagram || "").replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
            >
              Follow on Instagram →
            </a>
          </div>
          <div className="ig-grid">
            {Array.from({ length: 6 }).map((_, i) => {
              const p = instagram[i];
              if (!p) return <Placeholder key={i} label="IG post" />;
              return <img key={p.id} src={p.src} alt="Instagram post" />;
            })}
          </div>
        </section>

        <section className="cta-band">
          <div>
            <h2>Ready for a new look?</h2>
            <p>Pick a style, pick a time — confirmation is instant.</p>
          </div>
          <Link href="/book" className="btn btn-cream btn-lg" style={{ flex: "none" }}>
            Book online now
          </Link>
        </section>
      </main>
      <SiteFooter content={content} />
      <StickyBookBar phone={content.phone} />
    </>
  );
}
