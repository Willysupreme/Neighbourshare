"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { loginSchema } from "@/lib/validation/schemas";
import { getPostAuthRedirect } from "@/lib/postAuthRedirect";
import type { MultiFactorError, MultiFactorResolver } from "firebase/auth";
import { PhoneMultiFactorGenerator, TotpMultiFactorGenerator } from "firebase/auth";

const RECAPTCHA_CONTAINER_ID = "login-recaptcha-container";

export default function LoginPage() {
  const {
    login,
    resetPassword,
    firebaseUser,
    profile,
    loading,
    getMfaResolver,
    completeTotpSignIn,
    beginPhoneMfaChallenge,
    completePhoneMfaSignIn,
  } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCredentialError, setIsCredentialError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // MFA challenge state - factorType determines which challenge UI shows.
  // For phone, verificationId is set once beginPhoneMfaChallenge has
  // actually sent the SMS (a separate step from TOTP, which needs no
  // "send" step at all - the code already exists in the person's app).
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [factorType, setFactorType] = useState<"totp" | "phone" | null>(null);
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser) {
      router.replace(getPostAuthRedirect(profile));
    }
  }, [loading, firebaseUser, profile, router]);

  if (loading || firebaseUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  async function handleReset() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email above first, then click \"Forgot password?\" again.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch {
      // Deliberately vague: don't reveal whether an account exists for
      // this email (avoids leaking which addresses are registered users).
      setResetSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCredentialError(false);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const profile = await login(parsed.data.email, parsed.data.password);
      router.push(getPostAuthRedirect(profile));
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/multi-factor-auth-required") {
        // Password was correct - a second factor is required to finish
        // signing in. Not an error; switch to the appropriate challenge
        // step instead of showing a failure message.
        const mfaResolver = getMfaResolver(err as MultiFactorError);
        const hasPhone = mfaResolver.hints.some((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
        const hasTotp = mfaResolver.hints.some((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        setResolver(mfaResolver);
        setSubmitting(false);
        if (hasTotp) {
          // Prefer TOTP if both are somehow enrolled - no SMS round-trip
          // needed, so it resolves faster for the person.
          setFactorType("totp");
        } else if (hasPhone) {
          setFactorType("phone");
          await sendPhoneCode(mfaResolver);
        }
        return;
      }
      const { message, isCredentialIssue } = mapFirebaseError(err);
      setError(message);
      setIsCredentialError(isCredentialIssue);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPhoneCode(activeResolver: MultiFactorResolver) {
    setMfaError(null);
    setSendingCode(true);
    try {
      const id = await beginPhoneMfaChallenge(activeResolver, RECAPTCHA_CONTAINER_ID);
      setPhoneVerificationId(id);
    } catch (err) {
      console.error("[LoginPage] beginPhoneMfaChallenge failed:", err);
      setMfaError("Couldn't send a verification code. Please try again.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resolver) return;
    setMfaError(null);
    setSubmitting(true);
    try {
      const profile =
        factorType === "totp"
          ? await completeTotpSignIn(resolver, mfaCode.trim())
          : await completePhoneMfaSignIn(resolver, phoneVerificationId ?? "", mfaCode.trim());
      router.push(getPostAuthRedirect(profile));
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-verification-code") {
        setMfaError("That code doesn't look right. Please try again.");
      } else {
        setMfaError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function cancelMfa() {
    setResolver(null);
    setFactorType(null);
    setPhoneVerificationId(null);
    setMfaCode("");
    setMfaError(null);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display-heading text-3xl">Log in</h1>
      <p className="mt-1 text-sm text-neutral-600">Welcome back to NeighborShare.</p>

      {/* Always mounted (invisible), needed for the phone MFA challenge -
          Firebase's RecaptchaVerifier requires a real DOM element to
          attach to before it can be constructed. */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      {resolver ? (
        <form onSubmit={handleMfaSubmit} className="mt-6 space-y-4">
          <p className="text-sm text-neutral-600">
            {factorType === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : sendingCode
                ? "Sending a verification code to your phone..."
                : phoneVerificationId
                  ? "Enter the code we texted you."
                  : "Couldn't send a code."}
          </p>
          <input
            className="input"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            placeholder="123456"
            disabled={factorType === "phone" && !phoneVerificationId}
            autoFocus
          />
          {mfaError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {mfaError}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || mfaCode.trim().length !== 6 || (factorType === "phone" && !phoneVerificationId)}
            className="w-full rounded-md bg-gold px-4 py-2 font-medium text-white hover:bg-gold-dark disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>
          <button type="button" onClick={cancelMfa} className="w-full text-xs text-neutral-500 hover:underline">
            Back to log in
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button
            type="button"
            onClick={() => setResetMode((m) => !m)}
            className="text-xs text-leaf hover:underline"
          >
            Forgot password?
          </button>

          {resetMode && (
            <div className="rounded-md bg-neutral-50 p-3">
              {resetSent ? (
                <p className="text-sm text-leaf">
                  If an account exists for that email, a reset link is on its way.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={submitting}
                  className="btn-secondary text-sm"
                >
                  {submitting ? "Sending..." : `Send reset link to ${email || "this address"}`}
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <p>{error}</p>
              {isCredentialError && (
                <p className="mt-1">
                  New here?{" "}
                  <Link href="/register" className="font-medium underline">
                    Create an account
                  </Link>{" "}
                  instead.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gold px-4 py-2 font-medium text-white hover:bg-gold-dark disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-neutral-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-leaf">
          Sign up
        </Link>
      </p>
    </div>
  );
}

function mapFirebaseError(err: unknown): { message: string; isCredentialIssue: boolean } {
  const code = (err as { code?: string })?.code ?? "";

  // Deliberately vague across all three - never confirm or deny whether an
  // account exists for a given email, to avoid account enumeration.
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return { message: "Incorrect email or password.", isCredentialIssue: true };
  }
  if (code === "auth/too-many-requests") {
    return {
      message: "Too many attempts. Please wait a moment and try again.",
      isCredentialIssue: false,
    };
  }
  if (code === "auth/user-disabled") {
    return {
      message: "This account has been disabled. Contact an administrator if you think that's a mistake.",
      isCredentialIssue: false,
    };
  }
  if (code === "auth/network-request-failed") {
    return {
      message: "Network error - check your connection and try again.",
      isCredentialIssue: false,
    };
  }
  return { message: "Something went wrong logging in. Please try again.", isCredentialIssue: true };
}
