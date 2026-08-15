// Verification domain - see SRS.pdf FR-NBHD, FR-VERIFY

export interface Neighborhood {
  id: string;
  name: string;
  region?: string;
  verificationCode: string; // MVP simplification - see Technical_Debt_Plan.pdf item NS-TD-01
  latitude?: number;
  longitude?: number;
  createdBy: string;
  createdAt: string;
}

export type VerificationRequestStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
export type VerificationMethod = "plus_code" | "geolocation" | "manual_notes";

export interface NeighborhoodVerificationRequest {
  id: string;
  userId: string;
  userName: string;
  neighborhoodId: string;
  neighborhoodName: string;
  verificationMethod: VerificationMethod;
  // Approximate only - never precise. See fuzzCoordinates() in
  // src/domain/verification/rules.ts. Plus Code is stored as the raw text
  // the user typed, not geocoded server-side (avoids requiring a
  // billing-enabled Google Maps Platform account).
  plusCode?: string;
  approximateLatitude?: number;
  approximateLongitude?: number;
  notes?: string;
  status: VerificationRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}
