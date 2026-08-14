// NeighborShare domain types
// FR references map to SRS.pdf functional requirements (FR-xxx)

export type UserRole = "user" | "admin";
export type AccountStatus = "active" | "suspended";
export type VerificationStatus = "unverified" | "pending" | "verified";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  neighborhoodId: string;
  role: UserRole;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  bio?: string;
  photoUrl?: string;
  trustScore: number; // 0-5, see src/lib/trust/trustScore.ts
  completedTransactions: number;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

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

export type ItemCategory =
  | "power_tools"
  | "hand_tools"
  | "lawn_garden"
  | "cleaning"
  | "ladders_access"
  | "other";

export type ItemCondition = "excellent" | "good" | "fair" | "needs_repair";
export type ItemStatus = "active" | "inactive" | "removed";

export interface Item {
  id: string;
  ownerId: string;
  neighborhoodId: string;
  name: string;
  category: ItemCategory;
  description: string;
  condition: ItemCondition;
  imageUrls: string[];
  pickupInstructions?: string;
  status: ItemStatus; // owner-controlled listing status
  createdAt: string;
  updatedAt: string;
}

// Booking lifecycle state machine (see docs/diagrams/booking-state-machine.md)
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

export type NotificationType =
  | "request_received"
  | "request_approved"
  | "request_declined"
  | "pickup_reminder"
  | "return_reminder"
  | "damage_reported"
  | "review_available";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  relatedBookingId?: string;
  read: boolean;
  createdAt: string;
}
