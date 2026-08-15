import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";

// Deliberately excludes "admin" - granting full admin rights is not
// exposed through this endpoint at all, on purpose. That stays a manual
// Firebase console action, since a single button that can create new
// admins is a much bigger blast radius than promoting a neighbourhood
// representative.
const bodySchema = z.object({ role: z.enum(["user", "representative"]) });

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

    const target = snap.data() as { role?: string; name?: string };
    if (target.role === "admin") {
      throw new AuthError("Administrators' roles can't be changed through this action.", 400);
    }

    await userRef.update({ role: parsed.data.role, updatedAt: FieldValue.serverTimestamp() });

    await logAuditEntry(db, {
      actorId: profile.uid,
      actorName: profile.name,
      action: "role_changed",
      targetType: "user",
      targetId: targetUid,
      details: `${profile.name} set ${target.name ?? targetUid}'s role to ${parsed.data.role}`,
    });

    return NextResponse.json({ uid: targetUid, role: parsed.data.role });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/users/[uid]/role failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
