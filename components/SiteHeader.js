"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/#styles", label: "Styles" },
  { href: "/services", label: "Services & Pricing", path: "/services" },
  { href: "/#gallery", label: "Gallery" },
  { href: "/#faq", label: "FAQ" },
];

export default function SiteHeader({ announcement }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      {announcement ? <div className="announcement-bar">{announcement}</div> : null}
      <header className="site-header">
        <Link href="/" className="wordmark">
          My Hair Explorer<span className="dot">.</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} aria-current={l.path === pathname ? "page" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <Link href="/book" className="btn btn-bronze">
          Book an appointment
        </Link>
        <button
          className="menu-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      <nav className={`mobile-menu${open ? " open" : ""}`} aria-label="Mobile">
        {LINKS.map((l) => (
          <a key={l.label} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        <Link href="/book" className="btn btn-bronze btn-block" onClick={() => setOpen(false)}>
          Book an appointment
        </Link>
      </nav>
    </>
  );
}
