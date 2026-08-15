// Booking domain - see SRS.pdf FR-BOOK, FR-COND, FR-REVIEW

import { ItemCondition } from "@/domain/items/types";

// Booking lifecycle state machine - see src/domain/bookings/stateMachine.ts
export type BookingState =
  | "REQUESTED"
  | "APPROVED"
  | "RESERVED"
  | "PICKED_UP"
  | "IN_USE"
  | "RETURNED"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED"
  | "MAINTENANCE";

// States that block the item's calendar for availability checking (FR-BOOK-03)
export const BLOCKING_STATES: BookingState[] = [
  "REQUESTED",
  "APPROVED",
  "RESERVED",
  "PICKED_UP",
  "IN_USE",
];

// States that free the item back up
export const NON_BLOCKING_STATES: BookingState[] = [
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
  "RETURNED",
  "MAINTENANCE",
];

export interface Booking {
  id: string;
  itemId: string;
  ownerId: string;
  borrowerId: string;
  neighborhoodId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  note?: string;
  state: BookingState;
  conditionBefore?: ItemCondition;
  conditionAfter?: ItemCondition;
  // Denormalized display snapshots, captured at booking creation time -
  // documented, deliberate staleness tradeoff (see original type file
  // history); ownerId/borrowerId/itemId remain the source of truth.
  itemName: string;
  ownerName: string;
  borrowerName: string;
  borrowerTrustScore: number;
  borrowerVerified: boolean;
  // One-time, borrower-consented, fuzzed location snapshot - not live
  // tracking. See src/domain/verification/rules.ts fuzzCoordinates().
  borrowerLocation?: {
    latitude: number;
    longitude: number;
    capturedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type DamageSeverity = "minor" | "moderate" | "severe";
export type DamageStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export interface DamageReport {
  id: string;
  bookingId: string;
  itemId: string;
  reporterId: string;
  description: string;
  severity: DamageSeverity;
  status: DamageStatus;
  evidenceUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}
