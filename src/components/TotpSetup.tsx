"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { multiFactor, TotpMultiFactorGenerator, TotpSecret } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

export function TotpSetup() {
  const { firebaseUser, beginTotpEnrollment, confirmTotpEnrollment, unenrollMfaFactor } = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolledFactor = firebaseUser
    ? multiFactor(firebaseUser).enrolledFactors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    : undefined;

  useEffect(() => {
    if (!secret || !firebaseUser?.email) return;
    const uri = secret.generateQrCodeUrl(firebaseUser.email, "NeighborShare");
    QRCode.toDataURL(uri)
      .then(setQrDataUrl)
      .catch((err) => {
        console.error("[TotpSetup] QR code generation failed:", err);
        // Not fatal - the raw secret is still shown as a manual-entry
        // fallback below, so enrollment can still proceed without a QR
        // image if this ever fails for some reason (e.g. a browser
        // canvas restriction).
      });
  }, [secret, firebaseUser?.email]);

  async function handleBeginEnrollment() {
    setError(null);
    setEnrolling(true);
    try {
      const newSecret = await beginTotpEnrollment();
      setSecret(newSecret);
    } catch (err) {
      console.error("[TotpSetup] beginTotpEnrollment failed:", err);
      setError("Couldn't start authenticator app setup. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleConfirm() {
    if (!secret) return;
    setError(null);
    setConfirming(true);
    try {
      await confirmTotpEnrollment(secret, code.trim(), "Authenticator app");
      setSecret(null);
      setQrDataUrl(null);
      setCode("");
    } catch (err) {
      const errCode = (err as { code?: string })?.code;
      console.error("[TotpSetup] confirmTotpEnrollment failed:", { code: errCode });
      if (errCode === "auth/invalid-verification-code") {
        setError("That code doesn't look right. Check your authenticator app and try again.");
      } else {
        setError("Couldn't confirm the code. Please try again.");
      }
    } finally {
      setConfirming(false);
    }
  }

  async function handleRemove() {
    if (!enrolledFactor) return;
    if (!window.confirm("Remove your authenticator app? You'll no longer be asked for a code at sign-in.")) return;
    setRemoving(true);
    try {
      await unenrollMfaFactor(enrolledFactor.uid);
    } catch (err) {
      console.error("[TotpSetup] unenrollTotp failed:", err);
      setError("Couldn't remove the authenticator app. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  if (!enrolledFactor && !firebaseUser?.emailVerified) {
    return (
      <div className="card mt-3">
        <p className="text-sm text-neutral-500">
          Verify your email address first (see the banner on your dashboard) before setting up an
          authenticator app.
        </p>
      </div>
    );
  }

  if (enrolledFactor) {
    return (
      <div className="card mt-3">
        <p className="text-sm">
          <span className="text-leaf">&#10003;</span> Authenticator app enabled - you&apos;ll be asked
          for a code from your app when you sign in.
        </p>
        <button onClick={handleRemove} disabled={removing} className="btn-secondary mt-3 text-xs">
          {removing ? "Removing..." : "Remove authenticator app"}
        </button>
        {error && <p className="mt-2 text-xs text-clay">{error}</p>}
      </div>
    );
  }

  if (secret) {
    return (
      <div className="card mt-3">
        <p className="text-sm font-medium">Scan this with your authenticator app</p>
        <p className="mt-1 text-xs text-neutral-500">
          Google Authenticator, Authy, or any app that supports TOTP codes.
        </p>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- locally-generated data: URL, not an external/optimizable image
          <img src={qrDataUrl} alt="Scan with your authenticator app" className="mt-3 h-40 w-40" />
        )}
        <p className="mt-3 text-xs text-neutral-500">Can&apos;t scan? Enter this code manually:</p>
        <code className="mt-1 block break-all rounded bg-neutral-100 px-2 py-1 text-xs">
          {secret.secretKey}
        </code>
        <label className="mt-3 block text-xs font-medium">Enter the 6-digit code from your app</label>
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
              setSecret(null);
              setQrDataUrl(null);
              setCode("");
              setError(null);
            }}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-clay">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card mt-3">
      <p className="text-sm font-medium">Set up an authenticator app</p>
      <p className="mt-1 text-xs text-neutral-500">
        Add an extra layer of security - after your password, you&apos;ll also need a code from an
        app like Google Authenticator.
      </p>
      <button onClick={handleBeginEnrollment} disabled={enrolling} className="btn-secondary mt-3 text-xs">
        {enrolling ? "Starting..." : "Set up authenticator app"}
      </button>
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
    </div>
  );
}
