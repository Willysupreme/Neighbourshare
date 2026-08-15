import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";
import { Message } from "@/types";

const bodySchema = z.object({
  reason: z.string().trim().min(10, "Give a brief reason (at least 10 characters) for accessing this conversation."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const { profile } = await requireAuthenticatedUser(req);
    requireAdmin(profile);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "A reason is required." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const bookingSnap = await db.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const messagesSnap = await db
      .collection("bookings")
      .doc(bookingId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();
    const messages = messagesSnap.docs.map((d) => d.data() as Message);

    // Logged BEFORE returning data, not after - if the log write somehow
    // failed, we'd rather fail the whole request than let access happen
    // unlogged.
    await logAuditEntry(db, {
      actorId: profile.uid,
      actorName: profile.name,
      action: "admin_viewed_conversation",
      targetType: "booking",
      targetId: bookingId,
      details: `Reason: ${parsed.data.reason}`,
    });

    return NextResponse.json({ bookingId, messages });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/bookings/[bookingId]/messages failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
