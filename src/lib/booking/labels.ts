import { BookingState } from "@/types";

export const STATE_LABELS: Record<BookingState, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  RESERVED: "Reserved",
  PICKED_UP: "Picked up",
  IN_USE: "In use",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  MAINTENANCE: "Maintenance",
};

export const STATE_COLORS: Record<BookingState, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  RESERVED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-indigo-100 text-indigo-800",
  IN_USE: "bg-indigo-100 text-indigo-800",
  RETURNED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELLED: "bg-neutral-200 text-neutral-600",
  MAINTENANCE: "bg-orange-100 text-orange-800",
};
