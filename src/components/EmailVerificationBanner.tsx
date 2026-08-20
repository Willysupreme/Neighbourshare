"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export function EmailVerificationBanner() {
  const { firebaseUser, resendVerificationEmail, refreshEmailVerified } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Google sign-in accounts arrive already verified by Google itself -
  // this banner is only relevant to email/password accounts.
  if (!firebaseUser || firebaseUser.emailVerified || dismissed) return null;

  async function handleResend() {
    setError(null);
    setSending(true);
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err) {
      console.error("[EmailVerificationBanner] resend failed:", err);
      setError("Couldn't send the verification email. Please try again shortly.");
    } finally {
      setSending(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const verified = await refreshEmailVerified();
      if (!verified) {
        setError("Still not verified yet - check your inbox (and spam folder) for the link.");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/10 px-4 py-3">
      <div>
        <p className="text-sm font-medium">Please verify your email address</p>
        <p className="text-xs text-neutral-600">
          {sent ? "Verification email sent - check your inbox." : "Check your inbox for a verification link."}
        </p>
        {error && <p className="mt-1 text-xs text-clay">{error}</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={handleCheck} disabled={checking} className="btn-secondary text-xs">
          {checking ? "Checking..." : "I've verified it"}
        </button>
        <button onClick={handleResend} disabled={sending} className="btn-secondary text-xs">
          {sending ? "Sending..." : "Resend email"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-neutral-400 hover:text-neutral-600"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
