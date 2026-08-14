import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireAdmin, AuthError } from "@/lib/auth/verifyRequest";

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

    await itemRef.update({ status: "removed", updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ itemId, status: "removed" });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/items/[itemId]/remove failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
