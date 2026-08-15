"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { authedFetch } from "@/lib/apiClient";
import { ItemCategory, Wishlist } from "@/types";

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "power_tools", label: "Power tools" },
  { value: "hand_tools", label: "Hand tools" },
  { value: "lawn_garden", label: "Lawn & garden" },
  { value: "cleaning", label: "Cleaning equipment" },
  { value: "ladders_access", label: "Ladders & access" },
  { value: "other", label: "Other" },
];

function WishlistContent() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ItemCategory | "">("");
  const [keyword, setKeyword] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const snap = await getDocs(query(collection(db, "wishlists"), where("userId", "==", profile.uid)));
    setEntries(snap.docs.map((d) => d.data() as Wishlist));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category && !keyword.trim()) {
      setError("Add a category, a keyword, or both.");
      return;
    }
    setSubmitting(true);
    try {
      await authedFetch("/api/wishlists", {
        method: "POST",
        body: JSON.stringify({
          category: category || undefined,
          keyword: keyword.trim() || undefined,
          radiusKm,
        }),
      });
      setCategory("");
      setKeyword("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(entry: Wishlist) {
    await authedFetch(`/api/wishlists/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !entry.active }),
    });
    load();
  }

  async function remove(entry: Wishlist) {
    if (!window.confirm("Remove this wishlist entry?")) return;
    await authedFetch(`/api/wishlists/${entry.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="display-heading text-3xl">My wishlist</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Get notified when a matching item is listed nearby.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Category (optional)</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ItemCategory | "")}>
              <option value="">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Radius</span>
            <select className="input" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
              {[1, 2, 5, 10, 25].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Keyword (optional)</span>
          <input
            className="input"
            placeholder="e.g. pressure washer"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        {error && <p className="text-xs text-clay">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Saving..." : "Add to wishlist"}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-neutral-500">No wishlist entries yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {entry.category ? CATEGORIES.find((c) => c.value === entry.category)?.label : "Any category"}
                  {entry.keyword && ` · "${entry.keyword}"`}
                </p>
                <p className="text-xs text-neutral-500">Within {entry.radiusKm}km</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(entry)} className="btn-secondary text-xs">
                  {entry.active ? "Pause" : "Resume"}
                </button>
                <button onClick={() => remove(entry)} className="text-xs text-clay hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function WishlistPage() {
  return (
    <RequireAuth>
      <WishlistContent />
    </RequireAuth>
  );
}
