"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { TotpSetup } from "@/components/TotpSetup";

function SettingsContent() {
  const { profile, firebaseUser, linkGoogleAccount, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  if (!profile) return null;

  const googleLinked = firebaseUser?.providerData.some((p) => p.providerId === "google.com") ?? false;

  async function handleLinkGoogle() {
    setLinkError(null);
    setLinking(true);
    try {
      await linkGoogleAccount();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      console.error("[Settings] linkGoogleAccount failed:", {
        code,
        message: err instanceof Error ? err.message : String(err),
      });
      if (code === "auth/credential-already-in-use") {
        setLinkError("That Google account is already linked to a different NeighborShare account.");
      } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // Deliberate cancellation - not an error worth showing.
      } else if (code === "auth/popup-blocked") {
        setLinkError("Your browser blocked the popup. Please allow popups for this site and try again.");
      } else {
        setLinkError(`Something went wrong linking your Google account${code ? ` (${code})` : ""}. Please try again.`);
      }
    } finally {
      setLinking(false);
    }
  }

  async function toggle() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", profile!.uid), {
        restrictToVerifiedRequesters: !profile!.restrictToVerifiedRequesters,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  }

  async function toggleWishlistNotifications() {
    setSaving(true);
    try {
      const nextValue = !(profile!.wishlistNotificationsEnabled ?? true);
      await updateDoc(doc(db, "users", profile!.uid), {
        wishlistNotificationsEnabled: nextValue,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="display-heading text-3xl">Settings</h1>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Messaging preferences
      </h2>
      <div className="card mt-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={!!profile.restrictToVerifiedRequesters}
            onChange={toggle}
            disabled={saving}
          />
          <span>
            <span className="block text-sm font-medium">
              Only accept requests from verified neighbours
            </span>
            <span className="block text-xs text-neutral-500">
              When on, borrow requests (and therefore chat, which only opens once a booking
              exists) from unverified accounts will be turned away automatically.
            </span>
          </span>
        </label>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Sign-in methods
      </h2>
      <div className="card mt-3">
        {googleLinked ? (
          <p className="text-sm">
            <span className="text-leaf">&#10003;</span> Google account linked - you can sign in with
            either your email and password or Google.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">Link your Google account</p>
            <p className="mt-1 text-xs text-neutral-500">
              Link Google to your account for a faster sign-in next time, without needing your
              password.
            </p>
            <button onClick={handleLinkGoogle} disabled={linking} className="btn-secondary mt-3 text-xs">
              {linking ? "Linking..." : "Link Google account"}
            </button>
            {linkError && <p className="mt-2 text-xs text-clay">{linkError}</p>}
          </>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Two-factor authentication
      </h2>
      <TotpSetup />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Notification preferences
      </h2>
      <div className="card mt-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={profile.wishlistNotificationsEnabled ?? true}
            onChange={toggleWishlistNotifications}
            disabled={saving}
          />
          <span>
            <span className="block text-sm font-medium">Wishlist match alerts</span>
            <span className="block text-xs text-neutral-500">
              Turn off to keep your wishlist entries active without receiving notifications
              when something matches.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
