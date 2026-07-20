"use client";

import { Suspense, useEffect, useState } from "react";
import BookingFlow from "./BookingFlow";
import { fetchContent, fetchVisibleServices } from "@/lib/data";
import { FALLBACK_CONTENT } from "@/lib/seed-data";

export default function BookPage() {
  const [content, setContent] = useState(FALLBACK_CONTENT);
  const [services, setServices] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchContent().then(setContent).catch(console.error);
    fetchVisibleServices()
      .then(setServices)
      .catch((err) => {
        console.error(err);
        setError(true);
      });
  }, []);

  if (error) {
    return (
      <main style={{ padding: 48, maxWidth: 560, margin: "0 auto" }}>
        <h1>Booking is taking a break</h1>
        <p style={{ color: "var(--taupe)", lineHeight: 1.6 }}>
          We couldn&apos;t load the booking service. Please try again in a minute, or call{" "}
          {content.phone}.
        </p>
      </main>
    );
  }

  if (services === null) {
    return (
      <main style={{ padding: 48, textAlign: "center", color: "var(--taupe)" }}>Loading booking…</main>
    );
  }

  return (
    <Suspense>
      <BookingFlow services={services} content={content} />
    </Suspense>
  );
}
