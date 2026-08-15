// User domain - see SRS.pdf FR-AUTH, FR-ADMIN, FR-ROLE, FR-MSGPREF

import { RestrictionType } from "@/domain/moderation/types";

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
  trustScore: number; // 0-5, see src/domain/users/trustScore.ts
  completedTransactions: number;
  // Messaging Preferences: when true, this user only accepts new booking
  // requests (and therefore chat, since chat is booking-scoped) from
  // verified neighbours. Off by default - opting into a stricter
  // gate, not a default restriction. Approved for retention in the
  // rebuild - see REBUILD_DOCUMENTATION/03_REQUIREMENTS_BASELINE.md.
  restrictToVerifiedRequesters?: boolean;
  // P1 notification preference: lets a user keep their wishlist active
  // (still matching) while opting out of the alerts specifically.
  wishlistNotificationsEnabled?: boolean;
  // Rebuild Phase 16: denormalized summary of currently-active
  // AccountRestriction types (see src/domain/moderation/types.ts) for this
  // user. The full restriction history with reason/appliedBy/reviewDate
  // lives in the accountRestrictions collection - this array exists only
  // so both API routes AND Firestore rules can cheaply check "is this
  // user currently restricted from X" without a query, which matters
  // specifically for chat (a direct client write governed by rules, not
  // an API route).
  activeRestrictions?: RestrictionType[];
  createdAt: string; // ISO timestamp
  updatedAt: string;
}
