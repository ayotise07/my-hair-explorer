// Starter content for a fresh Firestore project — imported from
// Admin → Overview → "Import starter content".

export const FALLBACK_CONTENT = {
  headline: "Find the braid style that feels like |you|.",
  subline:
    "Boho, knotless, crotchet and stitch braids — hand-crafted with care. Book online in under a minute.",
  announcement: "",
  location: "BALTIMORE, MD · BY APPOINTMENT",
  phone: "(443) 620-3880",
  email: "hello@myhairexplorer.com",
  instagram: "@myhairexplorer",
  stats: { rating: "4.9★", styles: "300+" },
  signatureStyles: [],
};

export const SEED_CONTENT = {
  ...FALLBACK_CONTENT,
  signatureStyles: [
    { name: "Knotless braids", price: "from $180", image: "/images/small-knotless.png", serviceId: "medium-knotless" },
    { name: "Boho braids", price: "from $200", image: "/images/boho-braids.jpg", serviceId: "boho-waist" },
    { name: "Stitch braids", price: "from $70", image: "/images/stitch-long-braids.png", serviceId: "stitch-2" },
    { name: "Crotchet braids", price: "from $100", image: "", serviceId: "crotchet" },
  ],
};

export const SEED_SERVICES = [
  { id: "small-knotless", name: "Small Knotless Braids", price: "$200", priceFrom: 200, deposit: 30, duration: "5–6 hrs", hours: 6, tag: "Most popular", desc: "Fine, lightweight knotless braids with a tension-free finish that protects your edges.", category: "Knotless", image: "/images/small-knotless.png", visible: true },
  { id: "medium-knotless", name: "Medium Knotless Braids", price: "$180", priceFrom: 180, deposit: 30, duration: "4–5 hrs", hours: 5, tag: "Great first set", desc: "The everyday classic — full, versatile, and easy to style up or down.", category: "Knotless", image: "/images/knotless-front.png", visible: true },
  { id: "boho-waist", name: "Boho Braids, Waist Length", price: "$220", priceFrom: 220, deposit: 30, duration: "5–6 hrs", hours: 6, tag: "Signature", desc: "Knotless base with curly bohemian pieces woven through for soft movement.", category: "Boho", image: "/images/boho-waist-length.jpg", visible: true },
  { id: "boho-short", name: "Short Boho Braids", price: "$200", priceFrom: 200, deposit: 30, duration: "4–5 hrs", hours: 5, tag: "Low maintenance", desc: "All the boho texture at a shoulder-friendly length.", category: "Boho", image: "/images/boho-braids.jpg", visible: true },
  { id: "crotchet", name: "Crotchet Braids", price: "from $100", priceFrom: 100, deposit: 20, duration: "2–3 hrs", hours: 3, tag: "Fastest install", desc: "Pre-styled hair crocheted onto cornrows — big style, short chair time.", category: "Crotchet", image: "", visible: true },
  { id: "stitch-2", name: "Stitch Braids (Two)", price: "$70", priceFrom: 70, deposit: 15, duration: "1–1.5 hrs", hours: 2, tag: "Clean & sharp", desc: "Two sleek feed-in stitch braids with crisp, defined parts.", category: "Stitch", image: "/images/stitch-long-braids.png", visible: true },
  { id: "stitch-3", name: "Stitch Braids (Three)", price: "$90", priceFrom: 90, deposit: 15, duration: "1.5–2 hrs", hours: 2, tag: "", desc: "Three feed-in stitch braids, straight back or with a design.", category: "Stitch", image: "/images/long-braids.png", visible: true },
  { id: "stitch-4", name: "Stitch Braids (Four)", price: "$110", priceFrom: 110, deposit: 15, duration: "2–3 hrs", hours: 3, tag: "", desc: "Four feed-in stitch braids — a versatile everyday protective style.", category: "Stitch", image: "/images/long-braids.png", visible: true },
  { id: "underwig", name: "Underwig Weave", price: "$70", priceFrom: 70, deposit: 15, duration: "1–1.5 hrs", hours: 2, tag: "Wig prep", desc: "A flat, secure braid-down foundation for your wig installs.", category: "Stitch", image: "", visible: false },
  { id: "ponytail", name: "Pony Tail (Half Up Half Down)", price: "$80", priceFrom: 80, deposit: 15, duration: "1.5–2 hrs", hours: 2, tag: "Event ready", desc: "Sleek braided top with flowing lengths — perfect for occasions.", category: "Boho", image: "/images/ponytail-half-up.jpg", visible: true },
  { id: "kids", name: "Braided Hairstyles (Kids)", price: "$70–$150", priceFrom: 70, deposit: 15, duration: "1–3 hrs", hours: 3, tag: "Gentle pace", desc: "Age-appropriate, gentle braiding for kids — patience included.", category: "Kids", image: "/images/braided-ponytail.jpg", visible: true },
  { id: "custom", name: "Custom Style", price: "quote", priceFrom: 0, deposit: 0, duration: "varies", hours: 4, tag: "Bring a photo", desc: "Saw a look you love? Send a reference and we'll price it together.", category: "Knotless", image: "", visible: true },
].map((s, i) => ({ ...s, order: i, bookingsThisMonth: 0 }));

export const SEED_FAQS = [
  { q: "How should I prep my hair?", a: "Wash and deep-condition 1–2 days before, and come with hair blow-dried and detangled. Clean, stretched hair saves you time in the chair." },
  { q: "Is extension hair included?", a: "Extension hair is available in-studio for most styles, or you can bring your own — each service's booking page lists what's included." },
  { q: "How long will my appointment take?", a: "Stitch braids take 1–3 hours; knotless and boho sets take 4–6. Your booking confirmation shows an estimated finish time." },
  { q: "What's the deposit and reschedule policy?", a: "A small deposit secures your slot and goes toward your total. Reschedule free up to 48 hours before your appointment." },
  { q: "How long do styles last?", a: "With night wrapping and light oiling, knotless and boho sets typically last 6–8 weeks; stitch braids 2–4 weeks." },
].map((f, i) => ({ ...f, order: i }));

export const SEED_REVIEWS = [
  { name: "Danielle R.", stars: 5, service: "Medium Knotless", quote: "Lasted 8 weeks and didn't pull at all. First braider who actually asked about my edges.", status: "published", featured: true, when: "3 weeks ago" },
  { name: "Maya T.", stars: 5, service: "Boho, Waist Length", quote: "Eight weeks in and my boho braids still look day-one fresh. Booking online took me a minute.", status: "published", featured: true, when: "1 month ago" },
  { name: "Keisha W.", stars: 5, service: "Kids' Braids", quote: "My daughter actually enjoys getting her hair done now. Gentle, patient, and the parts are always perfect.", status: "published", featured: true, when: "1 month ago" },
  { name: "Tia M.", stars: 5, service: "Small Knotless", quote: "Came in with a Pinterest photo, left with something better. Booking online was so easy.", status: "pending", featured: false, when: "2 days ago" },
  { name: "Renee C.", stars: 4, service: "Boho, Waist Length", quote: "Beautiful boho set. Ran a bit past the estimate but worth it.", status: "pending", featured: false, when: "5 days ago" },
  { name: "Aisha B.", stars: 5, service: "Small Knotless", quote: "An experience, not just an appointment. Worth every dollar.", status: "published", featured: false, when: "2 months ago" },
];

// Local files uploaded to Storage during seeding.
export const SEED_PHOTOS = [
  { name: "knotless-back.png", local: "/images/hero-knotless-back.png", placements: ["Hero"] },
  { name: "boho-waist.jpg", local: "/images/boho-waist-length.jpg", placements: ["Hero", "Lookbook"] },
  { name: "ponytail-half.jpg", local: "/images/ponytail-half-up.jpg", placements: ["Hero", "Lookbook"] },
  { name: "knotless-front.png", local: "/images/knotless-front.png", placements: ["Instagram"] },
  { name: "boho-thumb.jpg", local: "/images/boho-thumb.jpg", placements: ["Instagram"] },
  { name: "braided-ponytail.jpg", local: "/images/braided-ponytail.jpg", placements: ["Instagram"] },
  { name: "long-braids.png", local: "/images/long-braids.png", placements: ["Instagram", "Lookbook"] },
  { name: "stitch-long.png", local: "/images/stitch-long-braids.png", placements: ["Lookbook"] },
].map((p, i) => ({ ...p, order: i }));
