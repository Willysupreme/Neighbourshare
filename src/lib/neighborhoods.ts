import { Neighborhood } from "@/types";

/**
 * MVP neighbourhood verification (§9 of project spec).
 *
 * A real address/geolocation verification system is out of scope for the
 * 48-hour MVP. Instead, each neighbourhood has a shared verification code
 * (analogous to an HOA/community bulletin code) that a resident would
 * plausibly already know. This is documented as a technical debt item
 * (NS-TD-01, Priority: Medium) with a proposed future resolution of
 * geolocation + address verification.
 *
 * In production this list would live in the `neighborhoods` Firestore
 * collection (admin-managed); it is hard-coded here for MVP simplicity.
 */
export const NEIGHBORHOODS: Neighborhood[] = [
  { id: "maplewood", name: "Maplewood", verificationCode: "MAPLE2026" },
  { id: "riverside", name: "Riverside", verificationCode: "RIVER2026" },
  { id: "oakhill", name: "Oak Hill", verificationCode: "OAK2026" },
  { id: "birchgrove", name: "Birch Grove", verificationCode: "BIRCH2026" },
];

export function findNeighborhood(id: string): Neighborhood | undefined {
  return NEIGHBORHOODS.find((n) => n.id === id);
}

export function verifyCode(neighborhoodId: string, code: string): boolean {
  const n = findNeighborhood(neighborhoodId);
  if (!n) return false;
  return n.verificationCode.trim().toLowerCase() === code.trim().toLowerCase();
}
