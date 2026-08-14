"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/context/RequireAuth";
import { itemSchema, ItemInput } from "@/lib/validation/schemas";
import { authedFetch } from "@/lib/apiClient";
import { ItemCategory, ItemCondition } from "@/types";

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "power_tools", label: "Power tools" },
  { value: "hand_tools", label: "Hand tools" },
  { value: "lawn_garden", label: "Lawn & garden" },
  { value: "cleaning", label: "Cleaning equipment" },
  { value: "ladders_access", label: "Ladders & access" },
  { value: "other", label: "Other" },
];

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "needs_repair", label: "Needs repair" },
];

function NewItemForm() {
  const router = useRouter();
  const [form, setForm] = useState<Partial<ItemInput>>({
    category: "power_tools",
    condition: "good",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = itemSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    setSubmitting(true);
    try {
      const { itemId } = await authedFetch("/api/items", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.push(`/items/${itemId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">List an item</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Share a tool or piece of equipment with your verified neighbors.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Item name</span>
          <input
            className="input"
            placeholder="Cordless drill"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Category</span>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ItemCategory }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Condition</span>
            <select
              className="input"
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as ItemCondition }))}
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Description</span>
          <textarea
            className="input"
            rows={4}
            placeholder="18V cordless drill with two batteries and a case. Great for small home projects."
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Pickup instructions <span className="text-neutral-400">(optional)</span>
          </span>
          <input
            className="input"
            placeholder="Front porch, text before you come by"
            value={form.pickupInstructions ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, pickupInstructions: e.target.value }))}
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
          {submitting ? "Publishing..." : "Publish listing"}
        </button>
      </form>
    </div>
  );
}

export default function NewItemPage() {
  return (
    <RequireAuth>
      <NewItemForm />
    </RequireAuth>
  );
}
