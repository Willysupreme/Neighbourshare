"use client";

import { useState } from "react";
import { multiFactor, PhoneMultiFactorGenerator } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

const RECAPTCHA_CONTAINER_ID = "phone-mfa-recaptcha-container";

export function PhoneMfaSetup() {
  const { firebaseUser, beginPhoneMfaEnrollment, confirmPhoneMfaEnrollment, unenrollMfaFactor } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolledFactor = firebaseUser
    ? multiFactor(firebaseUser).enrolledFactors.find((f) => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID)
    : undefined;

  async function handleSendCode() {
    setError(null);
    if (!phoneNumber.trim().startsWith("+")) {
      setError("Enter your number in international format, e.g. +233201234567.");
      return;
    }
    setSending(true);
    try {
      const id = await beginPhoneMfaEnrollment(phoneNumber.trim(), RECAPTCHA_CONTAINER_ID);
      setVerificationId(id);
    } catch (err) {
      const errCode = (err as { code?: string })?.code;
      console.error("[PhoneMfaSetup] beginPhoneMfaEnrollment failed:", { code: errCode });
      if (errCode === "auth/invalid-phone-number") {
        setError("That doesn't look like a valid phone number.");
      } else if (errCode === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a while and try again.");
      } else {
        setError(`Couldn't send a verification code${errCode ? ` (${errCode})` : ""}. Please try again.`);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setConfirming(true);
    try {
      await confirmPhoneMfaEnrollment(verificationId ?? "", code.trim(), "Phone");
      setVerificationId(null);
      setCode("");
      setPhoneNumber("");
    } catch (err) {
      const errCode = (err as { code?: string })?.code;
      console.error("[PhoneMfaSetup] confirmPhoneMfaEnrollment failed:", { code: errCode });
      if (errCode === "auth/invalid-verification-code") {
        setError("That code doesn't look right. Please try again.");
      } else {
        setError("Couldn't confirm the code. Please try again.");
      }
    } finally {
      setConfirming(false);
    }
  }

  async function handleRemove() {
    if (!enrolledFactor) return;
    if (!window.confirm("Remove phone verification? You'll no longer be asked for a code at sign-in.")) return;
    setRemoving(true);
    try {
      await unenrollMfaFactor(enrolledFactor.uid);
    } catch (err) {
      console.error("[PhoneMfaSetup] unenrollMfaFactor failed:", err);
      setError("Couldn't remove phone verification. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  if (!enrolledFactor && !firebaseUser?.emailVerified) {
    return (
      <div className="card mt-3">
        <p className="text-sm text-neutral-500">
          Verify your email address first (see the banner on your dashboard) before setting up phone
          verification.
        </p>
      </div>
    );
  }

  if (enrolledFactor) {
    return (
      <div className="card mt-3">
        <p className="text-sm">
          <span className="text-leaf">&#10003;</span> Phone verification enabled - you&apos;ll be
          texted a code when you sign in.
        </p>
        <button onClick={handleRemove} disabled={removing} className="btn-secondary mt-3 text-xs">
          {removing ? "Removing..." : "Remove phone verification"}
        </button>
        {error && <p className="mt-2 text-xs text-clay">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card mt-3">
      {/* Always mounted (invisible), needed for the phone MFA enrollment
          flow - Firebase's RecaptchaVerifier requires a real DOM element
          to attach to before it can be constructed. */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      <p className="text-sm font-medium">Set up phone verification</p>
      <p className="mt-1 text-xs text-neutral-500">
        An alternative to an authenticator app - you&apos;ll be texted a code when you sign in.
      </p>

      {verificationId ? (
        <>
          <label className="mt-3 block text-xs font-medium">Enter the code we texted you</label>
          <input
            className="input mt-1"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            placeholder="123456"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={handleConfirm} disabled={confirming || code.trim().length !== 6} className="btn-primary text-xs">
              {confirming ? "Confirming..." : "Confirm"}
            </button>
            <button
              onClick={() => {
                setVerificationId(null);
                setCode("");
                setError(null);
              }}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mt-3 block text-xs font-medium">Phone number (international format)</label>
          <input
            className="input mt-1"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+233201234567"
          />
          <button onClick={handleSendCode} disabled={sending} className="btn-secondary mt-3 text-xs">
            {sending ? "Sending..." : "Send code"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}
