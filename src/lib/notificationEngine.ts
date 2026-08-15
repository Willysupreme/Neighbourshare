import { FieldValue, Firestore } from "firebase-admin/firestore";
import { NotificationType } from "@/types";

/**
 * Central Notification Engine.
 *
 * Every feature that needs to notify a user (bookings, moderation,
 * verification decisions, future wishlist matches, etc.) calls this one
 * function rather than writing a notification document inline. This is
 * intentionally a thin wrapper today - its value is architectural, not
 * behavioral: one place to add rate-limiting, digesting, or a delivery
 * channel (email/push) later without touching every call site.
 */
export interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
  relatedBookingId?: string;
}

export async function notify(db: Firestore, input: NotifyInput): Promise<void> {
  const ref = db.collection("notifications").doc();
  await ref.set({
    id: ref.id,
    userId: input.userId,
    type: input.type,
    message: input.message,
    relatedBookingId: input.relatedBookingId ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Same as notify(), but takes a Firestore transaction so it can be called
 * from inside the existing booking-creation and state-transition
 * transactions without breaking their atomicity guarantee.
 */
export function notifyInTransaction(
  db: Firestore,
  tx: FirebaseFirestore.Transaction,
  input: NotifyInput
): void {
  const ref = db.collection("notifications").doc();
  tx.set(ref, {
    id: ref.id,
    userId: input.userId,
    type: input.type,
    message: input.message,
    relatedBookingId: input.relatedBookingId ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
