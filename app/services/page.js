"use client";

import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StickyBookBar from "@/components/StickyBookBar";
import ServicesList from "./ServicesList";
import { fetchContent, fetchVisibleServices } from "@/lib/data";
import { FALLBACK_CONTENT } from "@/lib/seed-data";

export default function ServicesPage() {
  const [content, setContent] = useState(FALLBACK_CONTENT);
  const [services, setServices] = useState(null);

  useEffect(() => {
    fetchContent().then(setContent).catch(console.error);
    fetchVisibleServices()
      .then(setServices)
      .catch((err) => {
        console.error(err);
        setServices([]);
      });
  }, []);

  return (
    <>
      <SiteHeader announcement={content.announcement} />
      <main>
        <div className="page-intro">
          <h1>Services &amp; pricing</h1>
          <p>
            Transparent prices, no surprises. Every service includes a consultation, parting, and finishing
            oil. Hair extensions available in-studio.
          </p>
        </div>
        {services === null ? (
          <p style={{ padding: "24px 48px", color: "var(--taupe)" }}>Loading services…</p>
        ) : (
          <ServicesList services={services} />
        )}
        <section className="prep-section">
          <h2>Before your appointment</h2>
          <div className="prep-grid">
            <div>
              <strong>Come with clean hair</strong>
              Wash and deep-condition 1–2 days before. Blow-dried and detangled saves you time in the chair.
            </div>
            <div>
              <strong>Hair included?</strong>
              Extension hair is available in-studio, or bring your own — check your style&apos;s notes when
              booking.
            </div>
            <div>
              <strong>Deposits &amp; reschedules</strong>A small deposit secures your slot. Reschedule free up
              to 48 hours before your appointment.
            </div>
          </div>
        </section>
      </main>
      <SiteFooter content={content} />
      <StickyBookBar phone={content.phone} />
    </>
  );
}
