import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";
import { notify } from "@/lib/notificationEngine";
import { AccountRestriction } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ restrictionId: string }> }
) {
  try {
    const { restrictionId } = await params;
    const { profile } = await requireAuthenticatedUser(req);
    requireAdmin(profile);

    const db = adminDb();
    const restrictionRef = db.collection("accountRestrictions").doc(restrictionId);
    const snap = await restrictionRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Restriction not found." }, { status: 404 });

    const restriction = snap.data() as AccountRestriction;
    if (restriction.status !== "active") {
      throw new AuthError("This restriction is not currently active.", 409);
    }

    const now = FieldValue.serverTimestamp();
    await restrictionRef.update({
      status: "lifted",
      liftedBy: profile.uid,
      liftedAt: now,
    });

    // Only remove this specific restriction type from the denormalized
    // array if no OTHER active restriction of the same type still exists
    // for this user (defensive - in this system a user should not
    // normally have two simultaneous active restrictions of the same
    // type, but this avoids incorrectly clearing the flag if that ever
    // happens).
    const stillActive = await db
      .collection("accountRestrictions")
      .where("userId", "==", restriction.userId)
      .where("restrictionType", "==", restriction.restrictionType)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (stillActive.empty) {
      await db.collection("users").doc(restriction.userId).update({
        activeRestrictions: FieldValue.arrayRemove(restriction.restrictionType),
        updatedAt: now,
      });
    }

    await logAuditEntry(db, {
      actorId: profile.uid,
      actorName: profile.name,
      action: "account_restriction_lifted",
      targetType: "user",
      targetId: restriction.userId,
      details: `${profile.name} lifted the "${restriction.restrictionType}" restriction`,
    });

    await notify(db, {
      userId: restriction.userId,
      type: "moderation_update",
      message: "A restriction on your account has been lifted by an administrator.",
    });

    return NextResponse.json({ lifted: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/restrictions/[restrictionId]/lift failed:", err);
    return NextResponse.json({ error: "Something went wrong lifting this restriction." }, { status: 500 });
  }
}
