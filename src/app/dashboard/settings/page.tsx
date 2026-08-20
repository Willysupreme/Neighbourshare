"use client";

import { useState, ChangeEvent } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { TotpSetup } from "@/components/TotpSetup";
import { PhoneMfaSetup } from "@/components/PhoneMfaSetup";
import { uploadImageToCloudinary, validateImageFile, ImageUploadError } from "@/lib/cloudinary";

function SettingsContent() {
  const { profile, firebaseUser, linkGoogleAccount, refreshProfile, updateDisplayName, updateUserPhoto } = useAuth();
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(profile?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  if (!profile) return null;

  const googleLinked = firebaseUser?.providerData.some((p) => p.providerId === "google.com") ?? false;

  async function handleSaveName() {
    setNameError(null);
    setNameSaved(false);
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError("Name can't be empty.");
      return;
    }
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      setNameSaved(true);
    } catch (err) {
      console.error("[Settings] updateDisplayName failed:", err);
      setNameError("Couldn't save your name. Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setPhotoError(null);
    try {
      validateImageFile(file);
    } catch (err) {
      setPhotoError(err instanceof ImageUploadError ? err.message : "That file can't be used.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadImageToCloudinary(file);
      await updateUserPhoto(url);
    } catch (err) {
      console.error("[Settings] photo upload/update failed:", err);
      setPhotoError("Couldn't update your photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

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
        Profile
      </h2>
      <div className="card mt-3">
        <div className="flex items-center gap-4">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- externally-hosted (Cloudinary/Google) URL, not a local/optimizable asset
            <img
              src={profile.photoUrl}
              alt=""
              className="h-16 w-16 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-xl text-neutral-400">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <label className="btn-secondary cursor-pointer text-xs">
              {uploadingPhoto ? "Uploading..." : "Change photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoChange}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
            {photoError && <p className="mt-1 text-xs text-clay">{photoError}</p>}
          </div>
        </div>

        <label className="mt-4 block text-xs font-medium">Name</label>
        <div className="mt-1 flex gap-2">
          <input
            className="input"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameSaved(false);
            }}
            maxLength={80}
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || nameInput.trim() === profile.name}
            className="btn-secondary shrink-0 text-xs"
          >
            {savingName ? "Saving..." : "Save"}
          </button>
        </div>
        {nameSaved && <p className="mt-1 text-xs text-leaf">Name updated.</p>}
        {nameError && <p className="mt-1 text-xs text-clay">{nameError}</p>}
      </div>

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
      <PhoneMfaSetup />

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
