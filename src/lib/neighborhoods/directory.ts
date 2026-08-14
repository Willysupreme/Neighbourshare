import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Neighborhood } from "@/types";
import { generateVerificationCode } from "./distance";

export async function listNeighborhoods(): Promise<Neighborhood[]> {
  const snap = await getDocs(collection(db, "neighborhoods"));
  return snap.docs.map((d) => d.data() as Neighborhood);
}

export async function getNeighborhood(id: string): Promise<Neighborhood | null> {
  const snap = await getDoc(doc(db, "neighborhoods", id));
  return snap.exists() ? (snap.data() as Neighborhood) : null;
}

/** Simple client-side substring search - fine at the neighborhood-directory scale expected for an MVP. */
export function filterByName(neighborhoods: Neighborhood[], query: string): Neighborhood[] {
  const q = query.trim().toLowerCase();
  if (!q) return neighborhoods;
  return neighborhoods.filter((n) => n.name.toLowerCase().includes(q));
}

export async function createNeighborhood(
  name: string,
  createdBy: string,
  coords?: { latitude: number; longitude: number }
): Promise<Neighborhood> {
  const ref = doc(collection(db, "neighborhoods"));
  const neighborhood: Omit<Neighborhood, "createdAt"> & { createdAt: unknown } = {
    id: ref.id,
    name: name.trim(),
    verificationCode: generateVerificationCode(name),
    createdBy,
    createdAt: serverTimestamp(),
    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
  };
  await setDoc(ref, neighborhood);
  return { ...neighborhood, createdAt: new Date().toISOString() } as Neighborhood;
}

/**
 * One-time convenience seed for a fresh project: a starter list of real,
 * well-known Ghanaian neighborhoods so the directory isn't empty on day
 * one. Anyone can trigger this (rules already allow authenticated create),
 * and it's safe to call more than once - Firestore doc IDs are
 * content-derived here so re-running just overwrites the same docs rather
 * than duplicating them.
 */
const STARTER_NEIGHBORHOODS: { name: string; region: string; latitude: number; longitude: number }[] = [
  { name: "Osu", region: "Greater Accra", latitude: 5.556, longitude: -0.1969 },
  { name: "East Legon", region: "Greater Accra", latitude: 5.65, longitude: -0.15 },
  { name: "Adenta", region: "Greater Accra", latitude: 5.708, longitude: -0.1667 },
  { name: "Madina", region: "Greater Accra", latitude: 5.6833, longitude: -0.1667 },
  { name: "Dansoman", region: "Greater Accra", latitude: 5.5333, longitude: -0.2667 },
  { name: "Tema", region: "Greater Accra", latitude: 5.6698, longitude: -0.0166 },
  { name: "Spintex", region: "Greater Accra", latitude: 5.6333, longitude: -0.1167 },
  { name: "Achimota", region: "Greater Accra", latitude: 5.6167, longitude: -0.2333 },
  { name: "Ahodwo", region: "Ashanti (Kumasi)", latitude: 6.6667, longitude: -1.6167 },
  { name: "Adum", region: "Ashanti (Kumasi)", latitude: 6.6926, longitude: -1.6244 },
];

export async function seedStarterNeighborhoods(createdBy: string): Promise<void> {
  const existing = await listNeighborhoods();
  const existingIds = new Set(existing.map((n) => n.id));

  const missing = STARTER_NEIGHBORHOODS.filter(
    (n) => !existingIds.has(n.name.toLowerCase().replace(/\s+/g, "-"))
  );
  if (missing.length === 0) return;

  const batch = writeBatch(db);
  for (const n of missing) {
    const ref = doc(db, "neighborhoods", n.name.toLowerCase().replace(/\s+/g, "-"));
    batch.set(ref, {
      id: ref.id,
      name: n.name,
      region: n.region,
      latitude: n.latitude,
      longitude: n.longitude,
      verificationCode: generateVerificationCode(n.name),
      createdBy,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
