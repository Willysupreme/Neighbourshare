"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import { itemSchema } from "@/lib/validation/schemas";
import { authedFetch } from "@/lib/apiClient";
import { uploadImagesToCloudinary, ImageUploadError } from "@/lib/cloudinary";
import { Item, ItemCategory, ItemCondition } from "@/types";

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

function EditItemForm() {
  const { itemId } = useParams<{ itemId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ItemCategory>("power_tools");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "items", itemId));
      if (!snap.exists()) {
        setItem(null);
        return;
      }
      const data = snap.data() as Item;
      setItem(data);
      setName(data.name);
      setCategory(data.category);
      setDescription(data.description);
      setCondition(data.condition);
      setPickupInstructions(data.pickupInstructions ?? "");
      setExistingImageUrls(data.imageUrls ?? []);
    }
    load();
  }, [itemId]);

  if (item === undefined) {
    return <p className="mx-auto max-w-lg px-4 py-10 text-sm text-neutral-500">Loading...</p>;
  }
  if (item === null) {
    return <p className="mx-auto max-w-lg px-4 py-10 text-sm text-neutral-500">Item not found.</p>;
  }
  if (!profile || (item.ownerId !== profile.uid && profile.role !== "admin")) {
    return <p className="mx-auto max-w-lg px-4 py-10 text-sm text-neutral-500">You can only edit your own listings.</p>;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const remaining = 5 - existingImageUrls.length - newFiles.length;
    const selected = Array.from(e.target.files ?? []).slice(0, Math.max(remaining, 0));
    if (selected.length === 0) return;
    setNewFiles((f) => [...f, ...selected]);
    setNewPreviews((p) => [...p, ...selected.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeExisting(url: string) {
    setExistingImageUrls((urls) => urls.filter((u) => u !== url));
  }

  function removeNew(index: number) {
    setNewFiles((f) => f.filter((_, i) => i !== index));
    setNewPreviews((p) => p.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    let uploadedUrls: string[] = [];
    if (newFiles.length > 0) {
      setUploading(true);
      try {
        uploadedUrls = await uploadImagesToCloudinary(newFiles);
      } catch (err) {
        setError(err instanceof ImageUploadError ? err.message : "Image upload failed.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const parsed = itemSchema.safeParse({
      name,
      category,
      description,
      condition,
      pickupInstructions,
      imageUrls: [...existingImageUrls, ...uploadedUrls],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    setSaving(true);
    try {
      await authedFetch(`/api/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      router.push(`/items/${itemId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!item) return;
    const nextStatus = item.status === "active" ? "inactive" : "active";
    const confirmMsg =
      nextStatus === "inactive"
        ? "Deactivate this listing? It will be hidden from Browse until you reactivate it."
        : "Reactivate this listing so it's visible in Browse again?";
    if (!window.confirm(confirmMsg)) return;

    try {
      await authedFetch(`/api/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setItem({ ...item, status: nextStatus });
      setNotice(nextStatus === "inactive" ? "Listing deactivated." : "Listing reactivated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="display-heading text-3xl">Edit listing</h1>
        <button
          type="button"
          onClick={toggleActive}
          className={item.status === "active" ? "btn-secondary" : "btn-primary"}
        >
          {item.status === "active" ? "Deactivate" : "Reactivate"}
        </button>
      </div>

      {notice && <p className="mt-3 rounded-md bg-leaf-light px-3 py-2 text-sm text-leaf">{notice}</p>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Item name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Category</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Condition</span>
            <select className="input" value={condition} onChange={(e) => setCondition(e.target.value as ItemCondition)}>
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
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Pickup instructions <span className="text-neutral-400">(optional)</span>
          </span>
          <input className="input" value={pickupInstructions} onChange={(e) => setPickupInstructions(e.target.value)} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Photos (up to 5)</span>
          {(existingImageUrls.length > 0 || newPreviews.length > 0) && (
            <div className="mb-2 grid grid-cols-5 gap-2">
              {existingImageUrls.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-16 w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExisting(url)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {newPreviews.map((src, i) => (
                <div key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNew(i)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFileSelect}
            disabled={existingImageUrls.length + newFiles.length >= 5}
            className="input"
          />
        </label>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={saving || uploading} className="btn-primary w-full py-2.5">
          {uploading ? "Uploading photos..." : saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}

export default function EditItemPage() {
  return (
    <RequireAuth>
      <EditItemForm />
    </RequireAuth>
  );
}
