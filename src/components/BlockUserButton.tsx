"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/apiClient";

export function BlockUserButton({
  userId,
  userName,
  onBlocked,
}: {
  userId: string;
  userName: string;
  onBlocked?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBlock() {
    if (
      !window.confirm(
        `Block ${userName}? They won't be able to send you new booking requests or messages. You can unblock them anytime from your dashboard.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authedFetch("/api/blocks", {
        method: "POST",
        body: JSON.stringify({ blockedUserId: userId }),
      });
      setBlocked(true);
      onBlocked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (blocked) {
    return <p className="text-xs text-clay">You&apos;ve blocked {userName}.</p>;
  }

  return (
    <div>
      <button type="button" onClick={handleBlock} disabled={busy} className="text-xs text-clay hover:underline">
        {busy ? "Blocking..." : `Block ${userName}`}
      </button>
      {error && <p className="mt-1 text-xs text-clay">{error}</p>}
    </div>
  );
}
