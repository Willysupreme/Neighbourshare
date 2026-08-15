import { describe, it, expect } from "vitest";
import { matchesWishlist } from "./wishlistMatching";

const drill = { name: "Cordless drill", description: "18V drill with two batteries", category: "power_tools" as const };
const ladder = { name: "Extension ladder", description: "6m aluminium ladder", category: "ladders_access" as const };

describe("matchesWishlist", () => {
  it("matches on category alone", () => {
    expect(matchesWishlist(drill, { category: "power_tools" })).toBe(true);
    expect(matchesWishlist(ladder, { category: "power_tools" })).toBe(false);
  });

  it("matches on keyword alone (case-insensitive, checks name and description)", () => {
    expect(matchesWishlist(drill, { keyword: "cordless" })).toBe(true);
    expect(matchesWishlist(drill, { keyword: "CORDLESS" })).toBe(true);
    expect(matchesWishlist(drill, { keyword: "batteries" })).toBe(true);
    expect(matchesWishlist(ladder, { keyword: "cordless" })).toBe(false);
  });

  it("requires both when both category and keyword are set", () => {
    expect(matchesWishlist(drill, { category: "power_tools", keyword: "cordless" })).toBe(true);
    expect(matchesWishlist(drill, { category: "ladders_access", keyword: "cordless" })).toBe(false);
    expect(matchesWishlist(drill, { category: "power_tools", keyword: "ladder" })).toBe(false);
  });

  it("never matches an empty wishlist (no category, no keyword)", () => {
    expect(matchesWishlist(drill, {})).toBe(false);
  });
});
