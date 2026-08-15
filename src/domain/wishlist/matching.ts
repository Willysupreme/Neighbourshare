import { ItemCategory } from "@/types";

export interface MatchableItem {
  name: string;
  description: string;
  category: ItemCategory;
}

export interface MatchableWishlist {
  category?: ItemCategory | null;
  keyword?: string | null;
}

/**
 * True if a newly-listed item matches a wishlist entry's category and/or
 * keyword criteria. Distance/radius is checked separately (see
 * src/lib/neighborhoods/distance.ts haversineDistanceKm) since that
 * requires neighborhood coordinates this function doesn't have.
 *
 * A wishlist with only a category set matches any item in that category.
 * A wishlist with only a keyword set matches a case-insensitive substring
 * of the item's name or description. A wishlist with both must match both.
 */
export function matchesWishlist(item: MatchableItem, wishlist: MatchableWishlist): boolean {
  if (!wishlist.category && !wishlist.keyword) return false;

  if (wishlist.category && item.category !== wishlist.category) {
    return false;
  }

  if (wishlist.keyword) {
    const needle = wishlist.keyword.trim().toLowerCase();
    const haystack = `${item.name} ${item.description}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}
