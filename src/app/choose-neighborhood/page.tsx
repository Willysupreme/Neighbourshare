"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/context/RequireAuth";
import {
  listNeighborhoods,
  filterByName,
  createNeighborhood,
  seedStarterNeighborhoods,
} from "@/lib/neighborhoods/directory";
import { sortByDistance } from "@/lib/neighborhoods/distance";
import { neighborhoodNameSchema } from "@/lib/validation/schemas";
import { Neighborhood } from "@/types";

function ChooseNeighborhoodContent() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setLoading(true);
    const list = await listNeighborhoods();
    setNeighborhoods(list);
    setLoading(false);
  }

  useEffect(() => {
    // load() sets `loading`/`neighborhoods` and is also reused by
    // loadStarterList() after seeding, so it can't be inlined into the
    // effect body. Standard fetch-on-mount pattern, empty deps = once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (!profile) return null;

  const filtered = filterByName(neighborhoods, query);
  const displayed = userCoords ? sortByDistance(filtered, userCoords.latitude, userCoords.longitude) : filtered;
  const exactMatch = neighborhoods.some((n) => n.name.toLowerCase() === query.trim().toLowerCase());

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location access - you can still search or add manually.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location - you can still search or add your neighborhood manually.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  async function selectNeighborhood(neighborhoodId: string) {
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, "users", profile!.uid), {
        neighborhoodId,
        verificationStatus: "unverified",
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      router.push("/verify-neighborhood");
    } catch {
      setError("Something went wrong saving your neighborhood. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function addNewNeighborhood() {
    const parsed = neighborhoodNameSchema.safeParse(query);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a neighborhood name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createNeighborhood(parsed.data, profile!.uid, userCoords ?? undefined);
      await selectNeighborhood(created.id);
    } catch {
      setError("Something went wrong creating that neighborhood. Please try again.");
      setSaving(false);
    }
  }

  async function loadStarterList() {
    setSeeding(true);
    setError(null);
    try {
      await seedStarterNeighborhoods(profile!.uid);
      await load();
    } catch {
      setError("Couldn't load the starter list. You can still add your neighborhood manually.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display-heading text-3xl">Find your neighborhood</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Search for your area, or add it if it&apos;s not listed yet - anyone can add a
        neighborhood NeighborShare doesn&apos;t know about.
      </p>

      <div className="mt-6 space-y-3">
        <input
          className="input"
          placeholder="Search e.g. Osu, East Legon, Tema..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-secondary text-sm">
          {locating ? "Getting your location..." : userCoords ? "Location set - sorted by distance" : "Use my location to sort by distance"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-neutral-500">Loading neighborhoods...</p>
        ) : neighborhoods.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500">
            <p>No neighborhoods yet - be the first to add one, or load a starter list.</p>
            <button
              type="button"
              onClick={loadStarterList}
              disabled={seeding}
              className="mt-2 text-leaf hover:underline"
            >
              {seeding ? "Loading..." : "Load starter list of Ghana neighborhoods"}
            </button>
          </div>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
            {displayed.length === 0 ? (
              <p className="p-2 text-sm text-neutral-500">No matches yet.</p>
            ) : (
              displayed.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  disabled={saving}
                  onClick={() => selectNeighborhood(n.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <span>{n.name}</span>
                  {n.region && <span className="text-xs text-neutral-400">{n.region}</span>}
                </button>
              ))
            )}
          </div>
        )}

        {query.trim().length >= 2 && !exactMatch && (
          <button
            type="button"
            onClick={addNewNeighborhood}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? "Adding..." : `Add "${query.trim()}" as a new neighborhood`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChooseNeighborhoodPage() {
  return (
    <RequireAuth>
      <ChooseNeighborhoodContent />
    </RequireAuth>
  );
}
