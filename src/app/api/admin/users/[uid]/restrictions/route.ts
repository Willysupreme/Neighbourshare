import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";
import { notify } from "@/lib/notificationEngine";
import { RestrictionType } from "@/types";

const bodySchema = z.object({
  restrictionType: z.enum(["listing_hidden", "cannot_book", "cannot_message", "cannot_list"]),
  reason: z.string().trim().min(10, "Give a specific reason (at least 10 characters)."),
  reviewDate: z.string().optional(),
});

const HUMAN_LABEL: Record<RestrictionType, string> = {
  listing_hidden: "your listings being hidden from discovery",
  cannot_book: "being unable to request new bookings",
  cannot_message: "being unable to send messages",
  cannot_list: "being unable to create new listings",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid: targetUid } = await params;
    const { profile } = await requireAuthenticatedUser(req);
    requireAdmin(profile);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const userRef = db.collection("users").doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const target = userSnap.data() as { role?: string; name?: string; activeRestrictions?: RestrictionType[] };
    if (target.role === "admin") {
      throw new AuthError("Administrators cannot be restricted through this action.", 400);
    }

    const now = FieldValue.serverTimestamp();
    const restrictionRef = db.collection("accountRestrictions").doc();
    await restrictionRef.set({
      id: restrictionRef.id,
      userId: targetUid,
      restrictionType: parsed.data.restrictionType,
      reason: parsed.data.reason,
      appliedBy: profile.uid,
      appliedAt: now,
      reviewDate: parsed.data.reviewDate ?? null,
      status: "active",
    });

    // Denormalized onto the user doc (deduplicated) so both API routes
    // and Firestore rules can check this cheaply without a query.
    await userRef.update({
      activeRestrictions: FieldValue.arrayUnion(parsed.data.restrictionType),
      updatedAt: now,
    });

    await logAuditEntry(db, {
      actorId: profile.uid,
      actorName: profile.name,
      action: "account_restricted",
      targetType: "user",
      targetId: targetUid,
      details: `${profile.name} applied restriction "${parsed.data.restrictionType}" to ${target.name ?? targetUid}: ${parsed.data.reason}`,
    });

    await notify(db, {
      userId: targetUid,
      type: "moderation_update",
      message: `An administrator has restricted your account: ${HUMAN_LABEL[parsed.data.restrictionType]}. Reason: ${parsed.data.reason}`,
    });

    return NextResponse.json({ restrictionId: restrictionRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/users/[uid]/restrictions failed:", err);
    return NextResponse.json({ error: "Something went wrong applying this restriction." }, { status: 500 });
  }
}
