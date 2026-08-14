import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
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

    if ((snap.data() as { role?: string }).role === "admin") {
      throw new AuthError("Administrators cannot be suspended through this action.", 400);
    }

    await userRef.update({ accountStatus: parsed.data.status, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ uid: targetUid, accountStatus: parsed.data.status });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/users/[uid]/suspend failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
