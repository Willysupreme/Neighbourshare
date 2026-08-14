import { describe, it, expect } from "vitest";
import { rangesOverlap, isRangeAvailable, validateDateRange } from "./overlap";
import { Booking } from "@/types";

function booking(overrides: Partial<Booking>): Pick<Booking, "id" | "startDate" | "endDate" | "state"> {
  return {
    id: overrides.id ?? "b1",
    startDate: overrides.startDate ?? "2026-06-10",
    endDate: overrides.endDate ?? "2026-06-12",
    state: overrides.state ?? "APPROVED",
  };
}

describe("rangesOverlap", () => {
  it("detects exact same-date overlap", () => {
    expect(
      rangesOverlap({ startDate: "2026-06-10", endDate: "2026-06-12" }, { startDate: "2026-06-10", endDate: "2026-06-12" })
    ).toBe(true);
  });

  it("detects partial overlap", () => {
    // existing: Jun 10-12, new: Jun 11-13
    expect(
      rangesOverlap({ startDate: "2026-06-11", endDate: "2026-06-13" }, { startDate: "2026-06-10", endDate: "2026-06-12" })
    ).toBe(true);
  });

  it("detects complete containment", () => {
    expect(
      rangesOverlap({ startDate: "2026-06-11", endDate: "2026-06-11" }, { startDate: "2026-06-10", endDate: "2026-06-15" })
    ).toBe(true);
  });

  it("does not flag non-overlapping (gap) ranges", () => {
    expect(
      rangesOverlap({ startDate: "2026-06-14", endDate: "2026-06-16" }, { startDate: "2026-06-10", endDate: "2026-06-12" })
    ).toBe(false);
  });

  it("treats back-to-back same-day handoff as overlapping (shared calendar day)", () => {
    // existing ends Jun 12, new starts Jun 12 -> same-day conflict, must be rejected
    expect(
      rangesOverlap({ startDate: "2026-06-12", endDate: "2026-06-14" }, { startDate: "2026-06-10", endDate: "2026-06-12" })
    ).toBe(true);
  });

  it("allows truly adjacent ranges with no shared day", () => {
    expect(
      rangesOverlap({ startDate: "2026-06-13", endDate: "2026-06-14" }, { startDate: "2026-06-10", endDate: "2026-06-12" })
    ).toBe(false);
  });
});

describe("isRangeAvailable", () => {
  const existing = [
    booking({ id: "b1", startDate: "2026-06-10", endDate: "2026-06-12", state: "APPROVED" }),
    booking({ id: "b2", startDate: "2026-07-01", endDate: "2026-07-03", state: "DECLINED" }),
    booking({ id: "b3", startDate: "2026-08-01", endDate: "2026-08-03", state: "CANCELLED" }),
    booking({ id: "b4", startDate: "2026-09-01", endDate: "2026-09-03", state: "COMPLETED" }),
  ];

  it("rejects a request overlapping an active (blocking) booking", () => {
    const result = isRangeAvailable({ startDate: "2026-06-11", endDate: "2026-06-13" }, existing);
    expect(result.available).toBe(false);
    expect(result.conflictingBookingIds).toEqual(["b1"]);
  });

  it("ignores declined bookings when checking availability", () => {
    const result = isRangeAvailable({ startDate: "2026-07-02", endDate: "2026-07-02" }, existing);
    expect(result.available).toBe(true);
  });

  it("ignores cancelled bookings", () => {
    const result = isRangeAvailable({ startDate: "2026-08-02", endDate: "2026-08-02" }, existing);
    expect(result.available).toBe(true);
  });

  it("ignores completed bookings", () => {
    const result = isRangeAvailable({ startDate: "2026-09-02", endDate: "2026-09-02" }, existing);
    expect(result.available).toBe(true);
  });

  it("excludes the booking's own id (for edit/re-check scenarios)", () => {
    const result = isRangeAvailable(
      { startDate: "2026-06-10", endDate: "2026-06-12" },
      existing,
      { excludeBookingId: "b1" }
    );
    expect(result.available).toBe(true);
  });

  it("is available when there is a genuine gap", () => {
    const result = isRangeAvailable({ startDate: "2026-06-14", endDate: "2026-06-16" }, existing);
    expect(result.available).toBe(true);
  });
});

describe("validateDateRange", () => {
  it("rejects end date before start date", () => {
    const result = validateDateRange({ startDate: "2026-06-12", endDate: "2026-06-10" });
    expect(result.valid).toBe(false);
  });

  it("rejects a start date in the past", () => {
    const result = validateDateRange({ startDate: "2020-01-01", endDate: "2020-01-02" });
    expect(result.valid).toBe(false);
  });

  it("accepts a valid future range", () => {
    const result = validateDateRange({ startDate: "2027-01-01", endDate: "2027-01-02" });
    expect(result.valid).toBe(true);
  });
});
