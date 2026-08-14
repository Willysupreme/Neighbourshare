import { describe, it, expect } from "vitest";
import { calculateTrustScore } from "./trustScore";

describe("calculateTrustScore", () => {
  it("gives an unrated unverified user a neutral baseline", () => {
    expect(calculateTrustScore({ ratings: [], isVerified: false, completedTransactions: 0 })).toBe(3.0);
  });

  it("gives an unrated verified user a slightly higher baseline", () => {
    expect(calculateTrustScore({ ratings: [], isVerified: true, completedTransactions: 0 })).toBe(3.5);
  });

  it("averages ratings", () => {
    const score = calculateTrustScore({ ratings: [5, 5, 5], isVerified: false, completedTransactions: 0 });
    expect(score).toBe(5); // capped at 5 even with bonuses
  });

  it("never exceeds 5", () => {
    const score = calculateTrustScore({ ratings: [5, 5, 5, 5], isVerified: true, completedTransactions: 50 });
    expect(score).toBeLessThanOrEqual(5);
  });

  it("never goes below 0", () => {
    const score = calculateTrustScore({ ratings: [1], isVerified: false, completedTransactions: 0 });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
