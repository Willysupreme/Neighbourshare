"use client";

// Isolated authentication diagnostic page - deliberately has NO
// dependency on AuthContext, Firestore, profile creation, or
// navigation. Its only purpose is to answer one question: does the
// persistent "Database is closing/hidden" error reproduce with raw
// Firebase Auth alone (signInWithPopup + onAuthStateChanged, nothing
// else), or only when the rest of the app's logic is also involved?
//
// This is a temporary diagnostic tool, not a permanent route - safe to
// remove once the investigation concludes either way.

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";

interface DiagnosticEvent {
  time: string;
  label: string;
  detail?: string;
}

export default function AuthTestPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [lastError, setLastError] = useState<{ code?: string; message: string; stack?: string } | null>(null);

  function log(label: string, detail?: string) {
    const time = new Date().toISOString().split("T")[1].replace("Z", "");
    setEvents((prev) => [...prev, { time, label, detail }]);
    console.log(`[auth-test ${time}] ${label}`, detail ?? "");
  }

  useEffect(() => {
    console.log("[auth-test] Mounting, attaching onAuthStateChanged listener");
    const unsubscribe = onAuthStateChanged(
      auth,
      (u) => {
        log("onAuthStateChanged fired", u ? `uid=${u.uid}` : "user=null");
        setUser(u);
        setAuthLoading(false);
      },
      (err) => {
        log("onAuthStateChanged ERROR", err.message);
      }
    );
    return () => {
      console.log("[auth-test] Unmounting, detaching listener");
      unsubscribe();
    };
  }, []);

  async function handleSignIn() {
    setLastError(null);
    setSigningIn(true);
    log("signInWithPopup: calling");
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      log("signInWithPopup: resolved", `uid=${result.user.uid}`);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      log("signInWithPopup: THREW", `code=${code} message=${message}`);
      setLastError({ code, message, stack });
      console.error("[auth-test] Full error object:", err);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    log("signOut: calling");
    await signOut(auth);
    log("signOut: resolved");
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Isolated Auth Diagnostic</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        No Firestore. No profile creation. No navigation. No AuthContext. Just raw signInWithPopup +
        onAuthStateChanged, to isolate whether &quot;Database is closing/hidden&quot; reproduces here too.
      </p>

      <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, marginBottom: 16 }}>
        <div>
          <strong>Auth loading:</strong> {String(authLoading)}
        </div>
        <div>
          <strong>Signed in:</strong> {user ? "yes" : "no"}
        </div>
        {user && (
          <>
            <div>
              <strong>UID:</strong> {user.uid}
            </div>
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Provider:</strong> {user.providerData[0]?.providerId}
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          style={{ padding: "8px 16px", marginRight: 8, cursor: "pointer" }}
        >
          {signingIn ? "Signing in..." : "Continue with Google (raw)"}
        </button>
        {user && (
          <button onClick={handleSignOut} style={{ padding: "8px 16px", cursor: "pointer" }}>
            Sign out
          </button>
        )}
      </div>

      {lastError && (
        <div style={{ padding: 16, background: "#fee", borderRadius: 8, marginBottom: 16, color: "#900" }}>
          <div>
            <strong>code:</strong> {lastError.code ?? "undefined"}
          </div>
          <div>
            <strong>message:</strong> {lastError.message}
          </div>
          {lastError.stack && (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 8 }}>{lastError.stack}</pre>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 14, marginBottom: 8 }}>Event log</h2>
      <div style={{ padding: 12, background: "#111", color: "#0f0", borderRadius: 8, maxHeight: 300, overflowY: "auto" }}>
        {events.map((e, i) => (
          <div key={i}>
            [{e.time}] {e.label}
            {e.detail ? ` - ${e.detail}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
