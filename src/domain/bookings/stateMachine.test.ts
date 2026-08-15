import { describe, it, expect } from "vitest";
import { canTransition } from "./stateMachine";

describe("canTransition", () => {
  it("allows owner to approve a REQUESTED booking", () => {
    expect(canTransition("REQUESTED", "APPROVED", "owner").allowed).toBe(true);
  });

  it("allows owner to decline a REQUESTED booking", () => {
    expect(canTransition("REQUESTED", "DECLINED", "owner").allowed).toBe(true);
  });

  it("allows borrower to cancel a REQUESTED booking", () => {
    expect(canTransition("REQUESTED", "CANCELLED", "borrower").allowed).toBe(true);
  });

  it("rejects borrower attempting to approve their own request", () => {
    expect(canTransition("REQUESTED", "APPROVED", "borrower").allowed).toBe(false);
  });

  it("rejects the invalid transition REQUESTED -> RETURNED", () => {
    const result = canTransition("REQUESTED", "RETURNED", "owner");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Invalid transition/);
  });

  it("rejects transitions out of terminal states", () => {
    expect(canTransition("COMPLETED", "IN_USE", "admin").allowed).toBe(false);
    expect(canTransition("CANCELLED", "REQUESTED", "admin").allowed).toBe(false);
  });

  it("allows the full happy-path lifecycle in sequence", () => {
    expect(canTransition("REQUESTED", "APPROVED", "owner").allowed).toBe(true);
    expect(canTransition("APPROVED", "RESERVED", "system").allowed).toBe(true);
    expect(canTransition("RESERVED", "PICKED_UP", "owner").allowed).toBe(true);
    expect(canTransition("PICKED_UP", "IN_USE", "system").allowed).toBe(true);
    expect(canTransition("IN_USE", "RETURNED", "owner").allowed).toBe(true);
    expect(canTransition("RETURNED", "COMPLETED", "owner").allowed).toBe(true);
  });

  it("allows RETURNED -> MAINTENANCE for a damaged item", () => {
    expect(canTransition("RETURNED", "MAINTENANCE", "owner").allowed).toBe(true);
  });

  it("rejects a random unrelated actor (borrower) from setting maintenance", () => {
    expect(canTransition("RETURNED", "MAINTENANCE", "borrower").allowed).toBe(false);
  });
});
