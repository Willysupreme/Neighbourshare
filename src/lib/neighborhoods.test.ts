import { describe, it, expect } from "vitest";
import { verifyCode } from "./neighborhoods";

describe("verifyCode", () => {
  it("accepts the correct code", () => {
    expect(verifyCode("maplewood", "MAPLE2026")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(verifyCode("maplewood", "maple2026")).toBe(true);
  });

  it("rejects an incorrect code", () => {
    expect(verifyCode("maplewood", "WRONGCODE")).toBe(false);
  });

  it("rejects an unknown neighborhood", () => {
    expect(verifyCode("nonexistent", "MAPLE2026")).toBe(false);
  });
});
