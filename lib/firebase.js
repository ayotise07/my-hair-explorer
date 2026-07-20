"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Web app config — safe to ship to the browser; access control lives in
// security rules + App Check, never in this config.
const firebaseConfig = {
  apiKey: "AIzaSyBwAxUW6NWz5jdBh1OuoHdks6Xub2HZe0A",
  authDomain: "my-hair-explorer-prod.firebaseapp.com",
  projectId: "my-hair-explorer-prod",
  storageBucket: "my-hair-explorer-prod.firebasestorage.app",
  messagingSenderId: "581158225717",
  appId: "1:581158225717:web:ac7c7c936aeefae7d5ee7c",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check — reCAPTCHA v3. Register the site key in
// Firebase Console → App Check, put it in NEXT_PUBLIC_RECAPTCHA_SITE_KEY.
// In dev a debug token is used so localhost keeps working once you allow the
// token in the console (it is printed to the browser console on first run).
let appCheckStarted = false;
function startAppCheck() {
  if (appCheckStarted || typeof window === "undefined") return;
  appCheckStarted = true;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return; // App Check not configured yet — enforcement must stay off
  if (process.env.NODE_ENV !== "production") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
startAppCheck();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
