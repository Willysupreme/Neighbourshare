"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";

function SettingsContent() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

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
