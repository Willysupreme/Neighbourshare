import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ blockedUserId: string }> }
) {
  try {
    const { blockedUserId } = await params;
    const { uid, profile } = await requireAuthenticatedUser(req);

    const db = adminDb();
    const blockId = `${uid}_${blockedUserId}`;
    const ref = db.collection("blocks").doc(blockId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Block not found." }, { status: 404 });
    }

    await ref.delete();

    await logAuditEntry(db, {
      actorId: uid,
      actorName: profile.name,
      action: "user_unblocked",
      targetType: "user",
      targetId: blockedUserId,
    });

    return NextResponse.json({ unblocked: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE /api/blocks/[blockedUserId] failed:", err);
    return NextResponse.json({ error: "Something went wrong unblocking this user." }, { status: 500 });
  }
}
