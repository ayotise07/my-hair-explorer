import Link from "next/link";

export default function StickyBookBar({ phone }) {
  const tel = (phone || "").replace(/\D/g, "");
  return (
    <div className="sticky-book-bar">
      <Link href="/book" className="btn btn-bronze" style={{ flex: 1 }}>
        Book now
      </Link>
      <a href={`tel:${tel}`} className="btn btn-outline-bronze" style={{ flex: "none" }}>
        Call
      </a>
    </div>
  );
}
