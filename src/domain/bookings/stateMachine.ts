import { BookingState } from "@/types";

export type BookingActor = "owner" | "borrower" | "admin" | "system";

interface Transition {
  to: BookingState;
  allowedActors: BookingActor[];
}

// Adjacency list of valid transitions. Any transition not listed here is invalid.
export const VALID_TRANSITIONS: Record<BookingState, Transition[]> = {
  REQUESTED: [
    { to: "APPROVED", allowedActors: ["owner", "admin"] },
    { to: "DECLINED", allowedActors: ["owner", "admin"] },
    { to: "CANCELLED", allowedActors: ["borrower", "admin"] },
  ],
  APPROVED: [
    { to: "RESERVED", allowedActors: ["system", "owner", "admin"] },
    { to: "CANCELLED", allowedActors: ["borrower", "owner", "admin"] },
  ],
  RESERVED: [
    { to: "PICKED_UP", allowedActors: ["owner", "admin"] },
    { to: "CANCELLED", allowedActors: ["borrower", "owner", "admin"] },
  ],
  PICKED_UP: [{ to: "IN_USE", allowedActors: ["system", "owner", "admin"] }],
  IN_USE: [{ to: "RETURNED", allowedActors: ["owner", "admin"] }],
  RETURNED: [
    { to: "COMPLETED", allowedActors: ["owner", "admin"] },
    { to: "MAINTENANCE", allowedActors: ["owner", "admin"] },
  ],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
  MAINTENANCE: [],
};

export function canTransition(
  from: BookingState,
  to: BookingState,
  actor: BookingActor
): { allowed: boolean; reason?: string } {
  const options = VALID_TRANSITIONS[from] ?? [];
  const match = options.find((t) => t.to === to);
  if (!match) {
    return {
      allowed: false,
      reason: `Invalid transition: ${from} -> ${to} is not a defined state transition.`,
    };
  }
  if (!match.allowedActors.includes(actor)) {
    return {
      allowed: false,
      reason: `Actor '${actor}' is not permitted to transition a booking from ${from} to ${to}.`,
    };
  }
  return { allowed: true };
}
