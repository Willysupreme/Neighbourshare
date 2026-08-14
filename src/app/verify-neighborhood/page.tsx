"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { verificationSchema } from "@/lib/validation/schemas";
import { verifyCode } from "@/lib/neighborhoods";

function VerifyForm() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!profile) return null;

  if (profile.verificationStatus === "verified") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-lg font-medium text-emerald-700">You&apos;re already verified ✓</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = verificationSchema.safeParse({
      neighborhoodId: profile!.neighborhoodId,
      code,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid code.");
      return;
    }

    if (!verifyCode(parsed.data.neighborhoodId, parsed.data.code)) {
      setError("That verification code doesn't match your neighborhood. Ask a neighbor or your community admin for the current code.");
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
      <h1 className="text-2xl font-semibold">Verify your neighborhood</h1>
      <p className="mt-2 text-sm text-neutral-600">
        For this MVP, enter the neighborhood code shared with residents of your community
        (e.g. on your community noticeboard or by a neighborhood admin). This is a simplified
        stand-in for full address/geolocation verification, which is planned for a future
        release.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Verification code</span>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. MAPLE2026"
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
          className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700"
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}

export default function VerifyNeighborhoodPage() {
  return (
    <RequireAuth>
      <VerifyForm />
    </RequireAuth>
  );
}
