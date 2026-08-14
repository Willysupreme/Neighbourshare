"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { authedFetch } from "@/lib/apiClient";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import { Item } from "@/types";

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { firebaseUser, profile } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "items", itemId));
      setItem(snap.exists() ? (snap.data() as Item) : null);
    }
    load();
  }, [itemId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!firebaseUser) {
      router.push("/login");
      return;
    }

    const parsed = bookingRequestSchema.safeParse({ itemId, startDate, endDate, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the dates.");
      return;
    }

    setSubmitting(true);
    try {
      await authedFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setSuccess("Request sent! You'll be notified once the owner responds.");
      setStartDate("");
      setEndDate("");
      setNote("");
    } catch (err) {
      // This surfaces the exact "unavailable during selected period" message
      // from the transactional overlap check in the API route (§13).
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (item === undefined) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-neutral-500">Loading...</p>;
  }
  if (item === null) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-neutral-500">Item not found.</p>;
  }

  const isOwner = profile?.uid === item.ownerId;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{item.name}</h1>
      <p className="mt-1 text-sm text-neutral-500 capitalize">{item.category.replace("_", " ")}</p>

      {item.imageUrls?.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {item.imageUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt={item.name} className="h-32 w-full rounded-md object-cover" />
          ))}
        </div>
      )}

      <p className="mt-4 text-neutral-700">{item.description}</p>
      <p className="mt-3 text-sm text-neutral-500">
        Condition: <span className="capitalize">{item.condition.replace("_", " ")}</span>
      </p>
      {item.pickupInstructions && (
        <p className="mt-1 text-sm text-neutral-500">Pickup: {item.pickupInstructions}</p>
      )}

      {isOwner ? (
        <div className="mt-8 flex items-center gap-3">
          <Link href={`/items/${item.id}/edit`} className="btn-secondary">
            Edit listing
          </Link>
          {item.status !== "active" && (
            <span className="badge bg-neutral-200 text-neutral-600">{item.status}</span>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card mt-8 space-y-4">
          <h2 className="font-medium">Request to borrow</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">Start date</span>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">End date</span>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Note <span className="text-neutral-400">(optional)</span>
            </span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send request"}
          </button>
        </form>
      )}
    </div>
  );
}
