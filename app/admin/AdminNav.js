"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/services", label: "Services & pricing" },
  { href: "/admin/content", label: "Homepage content" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/faq", label: "FAQ" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/availability", label: "Availability" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-logo">
        MHE<span className="dot">.</span> <span className="tag">Admin</span>
      </Link>
      <nav className="admin-nav" aria-label="Admin">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <Link href="/" className="admin-viewsite">
        ↗ View live site
      </Link>
      <button
        onClick={() => signOut(auth)}
        style={{
          margin: "0 22px",
          background: "none",
          border: "none",
          color: "var(--cream)",
          opacity: 0.6,
          fontFamily: "var(--sans)",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
          padding: "10px 0",
          minHeight: 40,
          textAlign: "left",
        }}
      >
        Sign out
      </button>
    </aside>
  );
}
