import { describe, it, expect } from "vitest";
import { haversineDistanceKm, sortByDistance, verifyNeighborhoodCode, generateVerificationCode, fuzzCoordinates } from "./distance";

describe("haversineDistanceKm", () => {
  it("returns ~0 for the same point", () => {
    expect(haversineDistanceKm(5.6, -0.19, 5.6, -0.19)).toBeCloseTo(0, 3);
  });

  it("returns a plausible distance between two known Accra-area points", () => {
    // Osu (~5.5560, -0.1969) to East Legon (~5.6500, -0.1500) - roughly 12km apart
    const km = haversineDistanceKm(5.556, -0.1969, 5.65, -0.15);
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(20);
  });
});

describe("sortByDistance", () => {
  const items = [
    { id: "far", latitude: 10, longitude: 10 },
    { id: "near", latitude: 5.56, longitude: -0.2 },
    { id: "no-coords", latitude: undefined, longitude: undefined },
  ];

  it("sorts closer points first", () => {
    const sorted = sortByDistance(items, 5.56, -0.19);
    expect(sorted[0].id).toBe("near");
  });

  it("puts entries without coordinates last, not excluded", () => {
    const sorted = sortByDistance(items, 5.56, -0.19);
    expect(sorted[sorted.length - 1].id).toBe("no-coords");
    expect(sorted).toHaveLength(3);
  });
});

describe("verifyNeighborhoodCode", () => {
  it("matches case-insensitively", () => {
    expect(verifyNeighborhoodCode({ verificationCode: "OSU-4K7Q" }, "osu-4k7q")).toBe(true);
  });

  it("rejects a wrong code", () => {
    expect(verifyNeighborhoodCode({ verificationCode: "OSU-4K7Q" }, "WRONG")).toBe(false);
  });
});

describe("generateVerificationCode", () => {
  it("produces a code prefixed by the neighborhood name", () => {
    expect(generateVerificationCode("Osu")).toMatch(/^OSU-[A-Z0-9]{4}$/);
  });

  it("falls back to NBHD prefix for names with no letters", () => {
    expect(generateVerificationCode("123")).toMatch(/^NBHD-[A-Z0-9]{4}$/);
  });
});

describe("fuzzCoordinates", () => {
  it("returns a point different from the input (extremely unlikely to be identical)", () => {
    const result = fuzzCoordinates(5.6, -0.19);
    expect(result.latitude === 5.6 && result.longitude === -0.19).toBe(false);
  });

  it("stays within the requested radius (with a small margin for the flat-earth approximation)", () => {
    for (let i = 0; i < 50; i++) {
      const result = fuzzCoordinates(5.6, -0.19, 300);
      const distanceKm = haversineDistanceKm(5.6, -0.19, result.latitude, result.longitude);
      expect(distanceKm).toBeLessThanOrEqual(0.35); // 300m + margin
    }
  });

  it("never returns the exact same point twice in a row (statistically)", () => {
    const a = fuzzCoordinates(5.6, -0.19);
    const b = fuzzCoordinates(5.6, -0.19);
    expect(a.latitude === b.latitude && a.longitude === b.longitude).toBe(false);
  });
});
