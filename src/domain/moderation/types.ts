// Moderation domain - see SRS.pdf FR-BLOCK, FR-COMMAUDIT, FR-ADMIN

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
  | "admin_viewed_conversation"
  | "account_restricted"
  | "account_restriction_lifted";

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

// NEW in the rebuild (REBUILD_DOCUMENTATION/03_REQUIREMENTS_BASELINE.md,
// 05_ARCHITECTURE.md): a distinct RESTRICTED state, more granular than the
// existing binary active/suspended AccountStatus. Type definition only at
// this phase (Phase 5) - not yet wired into any API route, Firestore
// collection, or UI. Implementation is scheduled for Phase 16
// (Admin/moderation), per the brief's own execution order - defining the
// contract now and building the feature later, rather than rushing both
// in the same phase.
export type RestrictionType =
  | "listing_hidden"      // item(s) hidden from discovery, owner unaffected otherwise
  | "cannot_book"         // cannot create new booking requests
  | "cannot_message"      // cannot send chat messages
  | "cannot_list";        // cannot create new listings

export type RestrictionStatus = "active" | "lifted" | "expired";

export interface AccountRestriction {
  id: string;
  userId: string;
  restrictionType: RestrictionType;
  reason: string;
  appliedBy: string; // admin uid
  appliedAt: string;
  reviewDate?: string; // when this restriction should be reconsidered
  status: RestrictionStatus;
  liftedBy?: string;
  liftedAt?: string;
}
