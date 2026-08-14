import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { damageReportSchema } from "@/lib/validation/schemas";
import { Booking } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = damageReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid damage report." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const bookingSnap = await db.collection("bookings").doc(parsed.data.bookingId).get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
    const booking = bookingSnap.data() as Booking;

    if (booking.ownerId !== uid && booking.borrowerId !== uid) {
      throw new AuthError("You are not a party to this booking.", 403);
    }

    const reportRef = db.collection("damageReports").doc();
    const now = FieldValue.serverTimestamp();
    await reportRef.set({
      id: reportRef.id,
      bookingId: parsed.data.bookingId,
      itemId: booking.itemId,
      reporterId: uid,
      description: parsed.data.description,
      severity: parsed.data.severity,
      status: "OPEN",
      evidenceUrls: [],
      createdAt: now,
      updatedAt: now,
    });

    // Notify the other party.
    const otherUserId = uid === booking.ownerId ? booking.borrowerId : booking.ownerId;
    const notificationRef = db.collection("notifications").doc();
    await notificationRef.set({
      id: notificationRef.id,
      userId: otherUserId,
      type: "damage_reported",
      message: "A damage/issue report was filed for a recent booking.",
      relatedBookingId: parsed.data.bookingId,
      read: false,
      createdAt: now,
    });

    return NextResponse.json({ reportId: reportRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/damage-reports failed:", err);
    return NextResponse.json({ error: "Something went wrong filing the report." }, { status: 500 });
  }
}
