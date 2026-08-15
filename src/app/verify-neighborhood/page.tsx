"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { getNeighborhood } from "@/lib/neighborhoods/directory";
import { verifyNeighborhoodCode, fuzzCoordinates } from "@/lib/neighborhoods/distance";
import { authedFetch } from "@/lib/apiClient";
import { Neighborhood, VerificationMethod } from "@/types";

function VerifyForm() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [neighborhood, setNeighborhood] = useState<Neighborhood | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile?.neighborhoodId) return;
      const n = await getNeighborhood(profile.neighborhoodId);
      setNeighborhood(n);
    }
    load();
  }, [profile?.neighborhoodId]);

  if (!profile) return null;

  if (profile.verificationStatus === "verified") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-lg font-medium text-leaf">You&apos;re already verified ✓</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-md bg-gold px-4 py-2 text-white hover:bg-gold-dark"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  if (profile.verificationStatus === "pending") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-lg font-medium">Your verification request is under review</p>
        <p className="mt-2 text-sm text-neutral-600">
          An administrator will review it shortly. You&apos;ll get a notification once it&apos;s
          decided. In the meantime, if you have the verification code, you can still use it
          instead.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-md bg-neutral-100 px-4 py-2 text-neutral-700 hover:bg-neutral-200"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!neighborhood) {
      setError("Couldn't load your neighborhood. Please try again.");
      return;
    }
    if (!code.trim()) {
      setError("Enter the verification code.");
      return;
    }
    if (!verifyNeighborhoodCode(neighborhood, code)) {
      setError("That verification code doesn't match your neighborhood. Ask a neighbor for the current code, or request an admin review below.");
      return;
    }

    setSubmitting(true);
    try {
      await updateDoc(doc(db, "users", profile!.uid), {
        verificationStatus: "verified",
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display-heading text-3xl">Verify your neighborhood</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {neighborhood
          ? <>Enter the verification code shared with residents of <strong>{neighborhood.name}</strong>.</>
          : "Loading your neighborhood..."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Verification code</span>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. OSU-4K7Q"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-gold px-4 py-2 font-medium text-white hover:bg-gold-dark disabled:opacity-50"
        >
          {submitting ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/choose-neighborhood")}
          className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600"
        >
          Wrong neighborhood? Change it
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700"
        >
          Skip for now
        </button>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <button
          type="button"
          onClick={() => setShowRequestForm((s) => !s)}
          className="text-sm text-gold hover:underline"
        >
          {showRequestForm ? "Hide" : "Don't have a code? Request an admin review"}
        </button>
        {showRequestForm && <RequestReviewForm />}
      </div>
    </div>
  );
}

function RequestReviewForm() {
  const [method, setMethod] = useState<VerificationMethod>("manual_notes");
  const [plusCode, setPlusCode] = useState("");
  const [notes, setNotes] = useState("");
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location access - try Plus Code or notes instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Fuzzed before it's even held in component state, let alone sent
        // to the server - the precise value never leaves getCurrentPosition.
        setCoords(fuzzCoordinates(pos.coords.latitude, pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setError("Location access was denied. Try Plus Code or notes instead.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = { verificationMethod: method };
    if (method === "plus_code") body.plusCode = plusCode.trim();
    if (method === "geolocation") {
      if (!coords) {
        setError("Click \"Use my approximate location\" first.");
        return;
      }
      body.approximateLatitude = coords.latitude;
      body.approximateLongitude = coords.longitude;
    }
    if (method === "manual_notes") body.notes = notes.trim();

    setSubmitting(true);
    try {
      await authedFetch("/api/verification-requests", { method: "POST", body: JSON.stringify(body) });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="mt-3 rounded-md bg-leaf-light px-3 py-2 text-sm text-leaf">
        Request submitted. An administrator will review it soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div className="flex gap-2 text-xs">
        {(["manual_notes", "plus_code", "geolocation"] as VerificationMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded px-2 py-1 ${method === m ? "bg-gold text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            {m === "manual_notes" ? "Describe" : m === "plus_code" ? "Plus Code" : "My location"}
          </button>
        ))}
      </div>

      {method === "manual_notes" && (
        <textarea
          className="input"
          rows={3}
          placeholder="Tell us a bit about your address or how a neighbor can vouch for you"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      )}
      {method === "plus_code" && (
        <input
          className="input"
          placeholder="e.g. 8FW4V75V+8Q"
          value={plusCode}
          onChange={(e) => setPlusCode(e.target.value)}
        />
      )}
      {method === "geolocation" && (
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-secondary text-sm">
          {locating ? "Getting location..." : coords ? "Location captured ✓" : "Use my approximate location"}
        </button>
      )}

      {error && <p className="text-xs text-clay">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full text-sm">
        {submitting ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}

export default function VerifyNeighborhoodPage() {
  return (
    <RequireAuth>
      <VerifyForm />
    </RequireAuth>
  );
}
