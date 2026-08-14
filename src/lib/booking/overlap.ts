import { Booking, BLOCKING_STATES } from "@/types";

export interface DateRange {
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
}

/**
 * Two inclusive date ranges [aStart, aEnd] and [bStart, bEnd] overlap iff
 *   aStart <= bEnd AND bStart <= aEnd
 * This single inequality correctly covers: exact match, partial overlap,
 * complete containment (either direction), and touching/adjacent ranges
 * when the same calendar day is shared. Adjacent-but-not-shared-day
 * bookings (e.g. one ends Jun 10, next starts Jun 11) do NOT overlap.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

/**
 * Determines whether a requested date range for an item is available,
 * given the item's existing bookings. Only bookings in a BLOCKING_STATES
 * state are considered - declined, cancelled, completed, returned, and
 * maintenance bookings do not block availability (see FR-BOOK-03, SRS §7).
 */
export function isRangeAvailable(
  requested: DateRange,
  existingBookings: Pick<Booking, "startDate" | "endDate" | "state" | "id">[],
  opts?: { excludeBookingId?: string }
): { available: boolean; conflictingBookingIds: string[] } {
  const conflicts = existingBookings.filter((b) => {
    if (opts?.excludeBookingId && b.id === opts.excludeBookingId) return false;
    if (!BLOCKING_STATES.includes(b.state)) return false;
    return rangesOverlap(requested, { startDate: b.startDate, endDate: b.endDate });
  });

  return {
    available: conflicts.length === 0,
    conflictingBookingIds: conflicts.map((c) => c.id),
  };
}

export function validateDateRange(requested: DateRange): { valid: boolean; error?: string } {
  if (!requested.startDate || !requested.endDate) {
    return { valid: false, error: "Start and end dates are required." };
  }
  if (requested.startDate > requested.endDate) {
    return { valid: false, error: "End date must be on or after the start date." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (requested.startDate < today) {
    return { valid: false, error: "Start date cannot be in the past." };
  }
  return { valid: true };
}
