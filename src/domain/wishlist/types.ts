// Wishlist domain - see SRS.pdf FR-WISH

import { ItemCategory } from "@/domain/items/types";

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
