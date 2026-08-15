import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";

const bodySchema = z.object({ blockedUserId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { uid, profile } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { blockedUserId } = parsed.data;

    if (blockedUserId === uid) {
      throw new AuthError("You can't block yourself.", 400);
    }

    const db = adminDb();
    const targetSnap = await db.collection("users").doc(blockedUserId).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const blockId = `${uid}_${blockedUserId}`;
    await db.collection("blocks").doc(blockId).set({
      id: blockId,
      blockerId: uid,
      blockedId: blockedUserId,
      createdAt: FieldValue.serverTimestamp(),
    });

    await logAuditEntry(db, {
      actorId: uid,
      actorName: profile.name,
      action: "user_blocked",
      targetType: "user",
      targetId: blockedUserId,
      details: `${profile.name} blocked ${(targetSnap.data() as { name?: string }).name ?? blockedUserId}`,
    });

    return NextResponse.json({ blockId }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/blocks failed:", err);
    return NextResponse.json({ error: "Something went wrong blocking this user." }, { status: 500 });
  }
}
