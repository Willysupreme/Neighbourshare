import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";
import { notify } from "@/lib/notificationEngine";
import { z } from "zod";

const bodySchema = z.object({ status: z.enum(["active", "suspended"]) });

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
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = adminDb();
    const userRef = db.collection("users").doc(targetUid);
    const snap = await userRef.get();
    if (!snap.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const targetName = (snap.data() as { role?: string; name?: string }).name ?? targetUid;
    if ((snap.data() as { role?: string }).role === "admin") {
      throw new AuthError("Administrators cannot be suspended through this action.", 400);
    }

    await userRef.update({ accountStatus: parsed.data.status, updatedAt: FieldValue.serverTimestamp() });

    await logAuditEntry(db, {
      actorId: profile.uid,
      actorName: profile.name,
      action: parsed.data.status === "suspended" ? "user_suspended" : "user_reinstated",
      targetType: "user",
      targetId: targetUid,
      details: `${profile.name} ${parsed.data.status === "suspended" ? "suspended" : "reinstated"} ${targetName}`,
    });

    // Rebuild Phase 14: this previously sent no notification at all - a
    // suspended user would only find out by hitting the suspension
    // screen mid-action. Brief §17 explicitly names MODERATION_UPDATE
    // as a required event type.
    await notify(db, {
      userId: targetUid,
      type: "moderation_update",
      message:
        parsed.data.status === "suspended"
          ? "Your account has been suspended by an administrator."
          : "Your account has been reinstated - you can use NeighborShare again.",
    });

    return NextResponse.json({ uid: targetUid, accountStatus: parsed.data.status });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/users/[uid]/suspend failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
