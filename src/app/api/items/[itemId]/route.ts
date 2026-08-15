import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { itemSchema } from "@/lib/validation/schemas";
import { logAuditEntry } from "@/lib/auditLog";
import { Item } from "@/types";

const updateSchema = itemSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { uid, profile } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid update." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const itemRef = db.collection("items").doc(itemId);
    const snap = await itemRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    const item = snap.data() as Item;

    if (item.ownerId !== uid && profile.role !== "admin") {
      throw new AuthError("You can only edit your own listings.", 403);
    }
    // Removed listings (admin-moderated) can't be resurrected by the owner
    // through this endpoint - only an admin action can do that, and this
    // MVP doesn't expose a "restore" flow, by design (§20 moderation intent).
    if (item.status === "removed" && profile.role !== "admin") {
      throw new AuthError("This listing was removed by an administrator and can't be edited.", 403);
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: uid };
    const d = parsed.data;
    if (d.name !== undefined) updates.name = d.name;
    if (d.category !== undefined) updates.category = d.category;
    if (d.description !== undefined) updates.description = d.description;
    if (d.condition !== undefined) updates.condition = d.condition;
    if (d.pickupInstructions !== undefined) updates.pickupInstructions = d.pickupInstructions;
    if (d.imageUrls !== undefined) updates.imageUrls = d.imageUrls;
    if (d.status !== undefined) updates.status = d.status;

    await itemRef.update(updates);

    if (profile.role === "admin" && item.ownerId !== uid) {
      await logAuditEntry(db, {
        actorId: uid,
        actorName: profile.name,
        action: "item_updated_by_representative",
        targetType: "item",
        targetId: itemId,
        details: `${profile.name} edited "${item.name}" on behalf of its owner`,
      });
    }

    return NextResponse.json({ itemId, updated: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/items/[itemId] failed:", err);
    return NextResponse.json({ error: "Something went wrong updating the listing." }, { status: 500 });
  }
}
