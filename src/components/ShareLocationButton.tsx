"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Booking } from "@/types";

export function ShareLocationButton({ booking }: { booking: Booking }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(!!booking.borrowerLocation);

  function handleShare() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location sharing.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await updateDoc(doc(db, "bookings", booking.id), {
            borrowerLocation: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              capturedAt: new Date().toISOString(),
            },
            updatedAt: serverTimestamp(),
          });
          setShared(true);
        } catch {
          setError("Couldn't save your location. Please try again.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError("Location access was denied or unavailable.");
        setBusy(false);
      },
      { timeout: 8000 }
    );
  }

  return (
    <div className="card">
      <p className="text-sm font-medium">Let {booking.ownerName} know where their item is</p>
      <p className="mt-1 text-xs text-neutral-500">
        This shares a single location snapshot - not ongoing tracking - visible only to{" "}
        {booking.ownerName} for this loan. It&apos;s automatically cleared once the item is
        marked returned.
      </p>
      {shared ? (
        <p className="mt-2 text-xs text-leaf">
          Location shared. You can update it again anytime while this loan is active.
        </p>
      ) : null}
      {error && <p className="mt-2 text-xs text-clay">{error}</p>}
      <button type="button" onClick={handleShare} disabled={busy} className="btn-secondary mt-3 text-sm">
        {busy ? "Getting location..." : shared ? "Update shared location" : "Share my location"}
      </button>
    </div>
  );
}
