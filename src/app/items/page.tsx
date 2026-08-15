"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { Item, ItemCategory, Neighborhood } from "@/types";
import { listNeighborhoods } from "@/lib/neighborhoods/directory";
import { haversineDistanceKm } from "@/lib/neighborhoods/distance";

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  power_tools: "Power tools",
  hand_tools: "Hand tools",
  lawn_garden: "Lawn & garden",
  cleaning: "Cleaning",
  ladders_access: "Ladders & access",
  other: "Other",
};

const RADIUS_OPTIONS = [1, 2, 5, 10, 25];

export default function BrowseItemsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ItemCategory | "all">("all");
  const [neighborhoodId, setNeighborhoodId] = useState<string | "all">("all");
  const [radiusKm, setRadiusKm] = useState<number | "any">("any");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "items"),
          where("status", "==", "active"),
          orderBy("createdAt", "desc")
        );
        const [itemsSnap, neighborhoodList] = await Promise.all([getDocs(q), listNeighborhoods()]);
        setItems(itemsSnap.docs.map((d) => d.data() as Item));
        setNeighborhoods(neighborhoodList);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const myNeighborhood = useMemo(
    () => neighborhoods.find((n) => n.id === profile?.neighborhoodId),
    [neighborhoods, profile?.neighborhoodId]
  );
  const neighborhoodById = useMemo(() => new Map(neighborhoods.map((n) => [n.id, n])), [neighborhoods]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (neighborhoodId !== "all" && item.neighborhoodId !== neighborhoodId) return false;
      if (search.trim()) {
        const haystack = `${item.name} ${item.description}`.toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      if (radiusKm !== "any" && myNeighborhood?.latitude != null && myNeighborhood?.longitude != null) {
        const itemNeighborhood = neighborhoodById.get(item.neighborhoodId);
        if (itemNeighborhood?.latitude == null || itemNeighborhood?.longitude == null) return false;
        const distance = haversineDistanceKm(
          myNeighborhood.latitude,
          myNeighborhood.longitude,
          itemNeighborhood.latitude,
          itemNeighborhood.longitude
        );
        if (distance > radiusKm) return false;
      }
      return true;
    });
  }, [items, category, neighborhoodId, search, radiusKm, myNeighborhood, neighborhoodById]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display-heading text-3xl">Browse nearby items</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <input
          className="input"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value as ItemCategory | "all")}
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={neighborhoodId}
          onChange={(e) => setNeighborhoodId(e.target.value)}
        >
          <option value="all">All neighborhoods</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        {myNeighborhood?.latitude != null && (
          <select
            className="input"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value === "any" ? "any" : Number(e.target.value))}
          >
            <option value="any">Any distance</option>
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                Within {r}km
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="mt-10 text-sm text-neutral-500">Loading items...</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No items match your filters yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Link key={item.id} href={`/items/${item.id}`} className="card hover:shadow-md transition-shadow">
              {item.imageUrls?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrls[0]}
                  alt={item.name}
                  className="mb-3 h-32 w-full rounded-md object-cover"
                />
              )}
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{item.name}</h2>
                <span className="badge bg-neutral-100 text-neutral-600">
                  {CATEGORY_LABELS[item.category]}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{item.description}</p>
              <p className="mt-3 text-xs text-neutral-400">
                Condition: {item.condition.replace("_", " ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
