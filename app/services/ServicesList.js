"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = ["All", "Knotless", "Boho", "Crotchet", "Stitch", "Kids"];

export default function ServicesList({ services }) {
  const [cat, setCat] = useState("All");
  const shown = cat === "All" ? services : services.filter((s) => s.category === cat);
  return (
    <>
      <div className="page-intro" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="filter-row" role="tablist" aria-label="Service category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              className={`chip${cat === c ? " active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="services-grid">
        {shown.map((s) => (
          <div className="service-card" key={s.id}>
            <div className="top">
              <h2>{s.name}</h2>
              <span className="price">{s.price}</span>
            </div>
            <div className="facts">
              <span>⏱ {s.duration}</span>
              {s.tag ? <span>{s.tag}</span> : null}
            </div>
            <p className="desc">{s.desc}</p>
            <Link href={`/book?service=${s.id}`} className="btn btn-outline-bronze">
              Book this style
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
