"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext(null);
export const useAdminUser = () => useContext(AuthContext);

const SIGN_IN_ERRORS = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/too-many-requests": "Too many attempts — wait a moment and try again.",
  "auth/network-request-failed": "Network error — check your connection.",
};

function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(SIGN_IN_ERRORS[err.code] || "Couldn't sign in — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--admin-bg)", padding: 20 }}>
      <form onSubmit={submit} className="editor-card" style={{ width: "100%", maxWidth: 380 }}>
        <span className="admin-logo" style={{ padding: 0, color: "var(--espresso)", fontSize: 24 }}>
          MHE<span style={{ color: "var(--copper)" }}>.</span>{" "}
          <span className="tag" style={{ color: "var(--taupe)" }}>Admin</span>
        </span>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)" }}>
          Sign in to manage your site, bookings and reviews.
        </p>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="error-box">{error}</div>}
        <button type="submit" className="btn btn-bronze btn-block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function NotAuthorized({ user }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--admin-bg)", padding: 20 }}>
      <div className="editor-card" style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 26 }}>Not authorized</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--taupe)", lineHeight: 1.6 }}>
          <strong>{user.email}</strong> is signed in but isn&apos;t on the admin list. Add a document
          with this user&apos;s UID to the <code>admins</code> collection in Firestore to grant access.
        </p>
        <button className="btn btn-outline" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const [state, setState] = useState({ loading: true, user: null, isAdmin: false });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ loading: false, user: null, isAdmin: false });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        setState({ loading: false, user, isAdmin: snap.exists() });
      } catch (err) {
        console.error("admin check:", err);
        setState({ loading: false, user, isAdmin: false });
      }
    });
  }, []);

  if (state.loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--admin-bg)", color: "var(--taupe)" }}>
        Checking sign-in…
      </div>
    );
  }
  if (!state.user) return <SignInScreen />;
  if (!state.isAdmin) return <NotAuthorized user={state.user} />;
  return <AuthContext.Provider value={state.user}>{children}</AuthContext.Provider>;
}
