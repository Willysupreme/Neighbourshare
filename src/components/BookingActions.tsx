"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/apiClient";
import { Booking, BookingState, ItemCondition } from "@/types";

interface Props {
  booking: Booking;
  viewerRole: "owner" | "borrower";
  onChanged: () => void;
}

const CONDITIONS: ItemCondition[] = ["excellent", "good", "fair", "needs_repair"];

export function BookingActions({ booking, viewerRole, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditionAfter, setConditionAfter] = useState<ItemCondition>("good");

  async function transition(to: BookingState, extra?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await authedFetch(`/api/bookings/${booking.id}/transition`, {
        method: "POST",
        body: JSON.stringify({ to, ...extra }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const actions: React.ReactNode[] = [];

  if (viewerRole === "owner" && booking.state === "REQUESTED") {
    actions.push(
      <button key="approve" disabled={busy} onClick={() => transition("APPROVED")} className="btn-primary">
        Approve
      </button>,
      <button key="decline" disabled={busy} onClick={() => transition("DECLINED")} className="btn-secondary">
        Decline
      </button>
    );
  }
  if (viewerRole === "borrower" && booking.state === "REQUESTED") {
    actions.push(
      <button key="cancel" disabled={busy} onClick={() => transition("CANCELLED")} className="btn-secondary">
        Cancel request
      </button>
    );
  }
  if (viewerRole === "owner" && booking.state === "APPROVED") {
    actions.push(
      <button key="reserve" disabled={busy} onClick={() => transition("RESERVED")} className="btn-primary">
        Confirm reservation
      </button>
    );
  }
  if ((viewerRole === "owner" || viewerRole === "borrower") && booking.state === "RESERVED") {
    actions.push(
      <button key="cancel" disabled={busy} onClick={() => transition("CANCELLED")} className="btn-secondary">
        Cancel booking
      </button>
    );
  }
  if (viewerRole === "owner" && booking.state === "RESERVED") {
    actions.push(
      <button key="pickup" disabled={busy} onClick={() => transition("PICKED_UP")} className="btn-primary">
        Mark picked up
      </button>
    );
  }
  if (viewerRole === "owner" && booking.state === "PICKED_UP") {
    actions.push(
      <button key="inuse" disabled={busy} onClick={() => transition("IN_USE")} className="btn-primary">
        Mark in use
      </button>
    );
  }
  if (viewerRole === "owner" && booking.state === "IN_USE") {
    actions.push(
      <div key="return" className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto"
          value={conditionAfter}
          onChange={(e) => setConditionAfter(e.target.value as ItemCondition)}
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          onClick={() => transition("RETURNED", { conditionAfter })}
          className="btn-primary"
        >
          Mark returned
        </button>
      </div>
    );
  }
  if (viewerRole === "owner" && booking.state === "RETURNED") {
    actions.push(
      <button key="complete" disabled={busy} onClick={() => transition("COMPLETED")} className="btn-primary">
        Mark completed
      </button>,
      <button
        key="maintenance"
        disabled={busy}
        onClick={() => transition("MAINTENANCE")}
        className="btn-secondary"
      >
        Send to maintenance
      </button>
    );
  }

  if (actions.length === 0) return error ? <ErrorNote error={error} /> : null;

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
      {error && <ErrorNote error={error} />}
    </div>
  );
}

function ErrorNote({ error }: { error: string }) {
  return <p className="mt-2 text-xs text-red-600">{error}</p>;
}
