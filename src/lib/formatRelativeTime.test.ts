import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./formatRelativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-01T12:00:00Z").getTime();

  it("shows 'just now' for under a minute", () => {
    expect(formatRelativeTime("2026-01-01T11:59:45Z", now)).toBe("just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime("2026-01-01T11:45:00Z", now)).toBe("15 min ago");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime("2026-01-01T09:00:00Z", now)).toBe("3h ago");
  });

  it("shows days for a day or more", () => {
    expect(formatRelativeTime("2025-12-30T12:00:00Z", now)).toBe("2d ago");
  });

  it("handles a Firestore-Timestamp-like object (has toDate(), not a string)", () => {
    const fakeTimestamp = { toDate: () => new Date("2026-01-01T11:45:00Z") };
    expect(formatRelativeTime(fakeTimestamp, now)).toBe("15 min ago");
  });

  it("falls back to 'now' for a null/undefined value rather than crashing", () => {
    expect(formatRelativeTime(null, now)).toBe("just now");
    expect(formatRelativeTime(undefined, now)).toBe("just now");
  });
});
