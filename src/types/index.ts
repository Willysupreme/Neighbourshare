// NeighborShare domain types
// FR references map to SRS.pdf functional requirements (FR-xxx)

export type UserRole = "user" | "admin" | "representative";
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
  // Messaging Preferences: when true, this user only accepts new booking
  // requests (and therefore chat, since chat is booking-scoped) from
  // verified neighbours. Off by default - opting into a stricter
  // gate, not a default restriction.
  restrictToVerifiedRequesters?: boolean;
  // P1 notification preference: lets a user keep their wishlist active
  // (still matching) while opting out of the alerts specifically.
  // Defaults to true (enabled) when absent - the field only needs to
  // exist once someone actually turns it off.
  wishlistNotificationsEnabled?: boolean;
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
  // Admin-assisted listing management: an administrator can create or edit
  // a listing on a resident's behalf (e.g. for owners who aren't
  // comfortable with the app themselves). ownerId is ALWAYS the true
  // owner - it is never overwritten with the administrator's own id.
  // createdBy/updatedBy record who actually performed the action, for
  // accountability, without changing who owns the item.
  createdBy?: string;
  updatedBy?: string;
  createdOnBehalfOf?: string; // present only when createdBy !== ownerId
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
  // Denormalized display snapshots, captured at booking creation time so
  // dashboards can render item/party names without an extra Firestore
  // read per row. MVP tradeoff: if a user later renames an item or edits
  // their display name, older bookings still show the name as it was at
  // request time - documented as acceptable staleness, not a bug, since
  // these are historical display labels, not the source of truth for
  // ownership/identity (ownerId/borrowerId/itemId remain authoritative).
  itemName: string;
  ownerName: string;
  borrowerName: string;
  // Snapshot of the borrower's reputation at request time - same
  // deliberate-staleness tradeoff as itemName/ownerName/borrowerName above.
  // Lets an owner see who they're dealing with before approving, without
  // an extra Firestore read per pending request on the dashboard.
  borrowerTrustScore: number;
  borrowerVerified: boolean;
  // One-time, borrower-consented location snapshot - not live tracking.
  // Captured when the borrower explicitly chooses to share it (typically
  // around pickup), visible only to that item's owner, and cleared
  // automatically when the booking transitions to RETURNED. See
  // src/components/ShareLocationButton.tsx and BookingLocationMap.tsx.
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

export type NotificationType =
  | "request_received"
  | "request_approved"
  | "request_declined"
  | "booking_cancelled"
  | "item_returned"
  | "pickup_reminder"
  | "return_reminder"
  | "damage_reported"
  | "review_available"
  | "verification_update"
  | "wishlist_match";

export interface Wishlist {
  id: string;
  userId: string;
  category?: ItemCategory;
  keyword?: string; // simple case-insensitive substring match against item name/description
  radiusKm: number; // matching radius from the user's own neighborhood
  active: boolean;
  // Dedup: item IDs already notified for, so the same match never
  // generates a second alert (e.g. if an item is edited after creation).
  notifiedItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  relatedBookingId?: string;
  read: boolean;
  createdAt: string;
}

export interface Block {
  id: string; // deterministic: `${blockerId}_${blockedId}`
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

export type AuditAction =
  | "user_suspended"
  | "user_reinstated"
  | "item_removed"
  | "user_blocked"
  | "user_unblocked"
  | "verification_request_approved"
  | "verification_request_rejected"
  | "item_created_on_behalf_of_owner"
  | "item_updated_by_representative"
  | "role_changed"
  | "admin_viewed_conversation";

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  targetType: "user" | "item" | "booking";
  targetId: string;
  details?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  text: string;
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
  // src/lib/neighborhoods/distance.ts. Plus Code is stored as the raw text
  // the user typed, not geocoded server-side - that would require a
  // billing-enabled Google Maps Platform account, which this project
  // deliberately avoids (same reasoning as using Cloudinary over Firebase
  // Storage, and Leaflet/OSM over Google Maps, elsewhere in the codebase).
  // An admin reviewer can still manually cross-check a Plus Code by hand.
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
