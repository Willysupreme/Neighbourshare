import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { canTransition, BookingActor } from "@/lib/booking/stateMachine";
import { Booking, BookingState } from "@/types";

const bodySchema = z.object({
  to: z.enum([
    "APPROVED",
    "DECLINED",
    "CANCELLED",
    "RESERVED",
    "PICKED_UP",
    "IN_USE",
    "RETURNED",
    "COMPLETED",
    "MAINTENANCE",
  ]),
  conditionAfter: z.enum(["excellent", "good", "fair", "needs_repair"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const { uid, profile } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid transition request." }, { status: 400 });
    }
    const { to, conditionAfter } = parsed.data;

    const db = adminDb();
    const bookingRef = db.collection("bookings").doc(bookingId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new AuthError("Booking not found.", 404);
      const booking = snap.data() as Booking;

      // Determine the caller's relationship to this booking - determines
      // which actor role (and therefore which transitions) they're allowed.
      let actor: BookingActor;
      if (profile.role === "admin") actor = "admin";
      else if (booking.ownerId === uid) actor = "owner";
      else if (booking.borrowerId === uid) actor = "borrower";
      else throw new AuthError("You are not a party to this booking.", 403);

      const check = canTransition(booking.state as BookingState, to, actor);
      if (!check.allowed) {
        throw new AuthError(check.reason ?? "This transition is not allowed.", 409);
      }

      const updates: Record<string, unknown> = {
        state: to,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (to === "RETURNED") {
        if (conditionAfter) updates.conditionAfter = conditionAfter;
        // Privacy cleanup: a shared location snapshot only makes sense
        // while the item is actively out on loan - clear it the moment
        // the item comes back, rather than leaving stale location data
        // sitting on a completed booking indefinitely.
        updates.borrowerLocation = FieldValue.delete();
      }

      tx.update(bookingRef, updates);

      const notificationRef = db.collection("notifications").doc();
      const notifyUserId = actor === "owner" ? booking.borrowerId : booking.ownerId;
      const messages: Partial<Record<BookingState, string>> = {
        APPROVED: "Your borrow request was approved.",
        DECLINED: "Your borrow request was declined.",
        CANCELLED: "A booking was cancelled.",
        RETURNED: "The item has been marked as returned.",
        COMPLETED: "Your booking is now complete - you can leave a review.",
      };
      if (messages[to]) {
        tx.set(notificationRef, {
          id: notificationRef.id,
          userId: notifyUserId,
          type: to === "APPROVED" ? "request_approved" : to === "DECLINED" ? "request_declined" : "review_available",
          message: messages[to],
          relatedBookingId: bookingId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      return { bookingId, newState: to };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/bookings/[bookingId]/transition failed:", err);
    return NextResponse.json({ error: "Something went wrong updating the booking." }, { status: 500 });
  }
}
