# My Hair Explorer

The redesigned My Hair Explorer site — the **"Golden Hour"** direction from the design doc
(`MyHairExplorer Redesign.html`): warm cream / espresso / braid-bronze palette, Cormorant Garamond +
Karla, booking-first.

Built with Next.js (App Router) on **Firebase**: Firestore for content and bookings, Storage for
photos, Auth for the admin, App Check (reCAPTCHA v3) to protect the backend.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## One-time Firebase setup (project `my-hair-explorer-prod`)

1. **Deploy security rules + indexes** (with an account that owns the project):

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore,storage --project my-hair-explorer-prod
   ```

   Until the rules are deployed, Firestore stays locked: the public site shows fallback copy and
   booking is disabled. Firestore (native mode) and Storage must be enabled in the console first.

2. **Enable Auth**: Console → Authentication → Sign-in method → enable **Email/Password**, then add
   the owner as a user (Users → Add user).

3. **Grant admin access**: Console → Firestore → create collection `admins`, add a document whose
   **ID is that user's UID** (copy it from the Authentication tab). The doc body can be
   `{ email: "..." }`. Security rules and the admin UI both key off this collection.

4. **Seed content**: sign in at `/admin` → Overview shows **"Import starter content"** → click it.
   This writes the services/FAQs/reviews/content and uploads the starter photos to Storage.

5. **App Check** (recommended before going live):
   - Console → App Check → register the web app with a **reCAPTCHA v3** key.
   - Copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
   - In dev, the SDK logs a debug token to the browser console — allow it under App Check → Apps →
     Manage debug tokens (or pin one via `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`).
   - Only after real traffic shows as verified, turn on **enforcement** for Firestore, Storage and
     Auth in the App Check tab.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Homepage — hero, signature styles, lookbook, reviews, FAQ, Instagram strip, CTA band |
| `/services` | Services & pricing with category filters |
| `/book` | 3-step booking flow with live availability, ends on the confirmation screen |
| `/admin` | Overview dashboard (auth required) + services, content, photos, FAQ, reviews, bookings |

## Architecture

- **Firestore collections**: `content/site` (copy + signature styles), `services`, `faqs`,
  `reviews`, `photos`, `bookings` (client PII — admin-only reads), `slots`, `admins`.
- **Double-booking is impossible by construction**: a booking transaction creates
  `slots/{date}_{time}` alongside the booking doc. The slot doc ID is the time itself, creating an
  existing ID counts as an update, and public updates are denied by rules — so the second client's
  transaction always fails.
- **Availability is PII-free**: the public booking flow only reads `slots` (date/time/status), never
  `bookings`.
- **Admin authorization** is the `admins/{uid}` collection, enforced in Firestore *and* Storage
  rules (cross-service `firestore.exists()`), not just in the UI. Manage it from the console only.
- **Public reads are rule-shaped**: services must be queried with `visible == true`, reviews with
  `status == "published"` — the composite index for services ships in `firestore.indexes.json`.
- Photo uploads go to Storage under `photos/` (images only, ≤10 MB) with download URLs stored on the
  Firestore doc.
- Studio schedule (start times, closed Thu/Sun) lives in `lib/schedule.js`.

## Notes

- The web Firebase config in `lib/firebase.js` is public by design; all protection comes from
  security rules + App Check.
- Booking "deposit" is recorded but not charged — payment integration (e.g. Stripe) is a follow-up.
- Brand tokens are CSS variables at the top of `app/globals.css`.
