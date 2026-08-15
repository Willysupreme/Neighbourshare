import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";
import { logAuditEntry } from "@/lib/auditLog";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { profile } = await requireAuthenticatedUser(req);
    requireAdmin(profile);

    const db = adminDb();
    const itemRef = db.collection("items").doc(itemId);
    const snap = await itemRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const itemName = (snap.data() as { name?: string }).name ?? itemId;

    await itemRef.update({ status: "removed", updatedAt: FieldValue.serverTimestamp() });

    await logAuditEntry(db, {
      actorId: profile.uid,
      actorName: profile.name,
      action: "item_removed",
      targetType: "item",
      targetId: itemId,
      details: `${profile.name} removed listing "${itemName}"`,
    });

    return NextResponse.json({ itemId, status: "removed" });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/items/[itemId]/remove failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
