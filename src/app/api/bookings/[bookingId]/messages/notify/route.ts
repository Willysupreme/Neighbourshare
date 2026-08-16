import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { notify } from "@/lib/notificationEngine";
import { Booking } from "@/types";

const bodySchema = z.object({
  preview: z.string().trim().max(120), // short excerpt only, not the full message
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
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = adminDb();
    const bookingSnap = await db.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
    const booking = bookingSnap.data() as Booking;

    if (booking.ownerId !== uid && booking.borrowerId !== uid) {
      throw new AuthError("You are not a party to this booking.", 403);
    }

    const recipientId = booking.ownerId === uid ? booking.borrowerId : booking.ownerId;

    // Rebuild Phase 18 security review: this route previously trusted the
    // client's claim that a message was sent, with no verification - any
    // booking party could call it directly with arbitrary text and spam
    // fake notifications to the other party without ever writing a real
    // message. Now requires a genuine, recent (last 30s) message from
    // this sender to actually exist before proceeding.
    const recentMessages = await db
      .collection("bookings")
      .doc(bookingId)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const latest = recentMessages.docs[0]?.data();
    const latestCreatedAtMs = latest?.createdAt?.toMillis?.() ?? 0;
    const isRecentAndFromSender = latest?.senderId === uid && Date.now() - latestCreatedAtMs < 30_000;
    if (!isRecentAndFromSender) {
      throw new AuthError("No recent message found to notify about.", 400);
    }

    // If the recipient has blocked the sender, the Firestore rule already
    // prevented the message write itself from succeeding - this route is
    // never reached in that case (the client only calls it after a
    // successful send). No separate block check needed here.
    await notify(db, {
      userId: recipientId,
      type: "message_received",
      message: `${profile.name}: ${parsed.data.preview}`,
      relatedBookingId: bookingId,
    });

    return NextResponse.json({ notified: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Deliberately non-fatal from the caller's perspective - a failure to
    // notify should never be surfaced as if the message itself failed to
    // send, since the message write already succeeded by the time this
    // route is called.
    console.error("POST /api/bookings/[bookingId]/messages/notify failed:", err);
    return NextResponse.json({ error: "Notification could not be sent." }, { status: 500 });
  }
}
