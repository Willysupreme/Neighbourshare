// Item domain - see SRS.pdf FR-ITEM

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
  // Admin-assisted listing management (FR-ASSIST): an administrator or
  // representative can create/edit a listing on a resident's behalf.
  // ownerId is ALWAYS the true owner - never overwritten with the
  // administrator's own id. createdBy/updatedBy record who actually
  // performed the action, for accountability, without changing ownership.
  createdBy?: string;
  updatedBy?: string;
  createdOnBehalfOf?: string; // present only when createdBy !== ownerId
  createdAt: string;
  updatedAt: string;
}
