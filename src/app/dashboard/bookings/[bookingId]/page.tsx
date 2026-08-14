"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { authedFetch } from "@/lib/apiClient";
import { damageReportSchema, reviewSchema } from "@/lib/validation/schemas";
import { STATE_LABELS, STATE_COLORS } from "@/lib/booking/labels";
import { Booking, DamageSeverity } from "@/types";

function BookingDetailContent() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "bookings", bookingId));
      setBooking(snap.exists() ? (snap.data() as Booking) : null);
    }
    load();
  }, [bookingId]);

  if (booking === undefined) return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-neutral-500">Loading...</p>;
  if (booking === null) return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-neutral-500">Booking not found.</p>;
  if (!profile || (booking.ownerId !== profile.uid && booking.borrowerId !== profile.uid && profile.role !== "admin")) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-neutral-500">You don&apos;t have access to this booking.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {booking.itemName} · {booking.startDate} → {booking.endDate}
        </h1>
        <span className={`badge ${STATE_COLORS[booking.state]}`}>{STATE_LABELS[booking.state]}</span>
      </div>

      {booking.conditionBefore && (
        <p className="mt-2 text-sm text-neutral-600">
          Condition before: <span className="capitalize">{booking.conditionBefore.replace("_", " ")}</span>
        </p>
      )}
      {booking.conditionAfter && (
        <p className="text-sm text-neutral-600">
          Condition after: <span className="capitalize">{booking.conditionAfter.replace("_", " ")}</span>
        </p>
      )}

      {["PICKED_UP", "IN_USE", "RETURNED", "COMPLETED"].includes(booking.state) && (
        <DamageReportForm bookingId={booking.id} />
      )}

      {booking.state === "COMPLETED" && <ReviewForm bookingId={booking.id} />}
    </div>
  );
}

function DamageReportForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<DamageSeverity>("minor");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = damageReportSchema.safeParse({ bookingId, description, severity });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setSubmitting(true);
    try {
      await authedFetch("/api/damage-reports", { method: "POST", body: JSON.stringify(parsed.data) });
      setSuccess(true);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mt-6">
      <button onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-neutral-700">
        {open ? "Hide" : "Report an issue / damage"}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">What happened?</span>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Severity</span>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as DamageSeverity)}>
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">Report filed. Thank you.</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </form>
      )}
    </div>
  );
}

function ReviewForm({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = reviewSchema.safeParse({ bookingId, rating, comment });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setSubmitting(true);
    try {
      await authedFetch("/api/reviews", { method: "POST", body: JSON.stringify(parsed.data) });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <p className="card mt-6 text-sm text-emerald-700">Thanks for your review!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-6 space-y-3">
      <h2 className="font-medium">Leave a review</h2>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Rating</span>
        <select className="input w-auto" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} star{r !== 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Comment (optional)</span>
        <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}

export default function BookingDetailPage() {
  return (
    <RequireAuth>
      <BookingDetailContent />
    </RequireAuth>
  );
}
