import "./globals.css";

export const metadata = {
  title: "My Hair Explorer — Braids in Baltimore, MD",
  description:
    "Boho, knotless, crotchet and stitch braids — hand-crafted with care in Baltimore. Book online in under a minute.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
