import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";

async function getOwnedWishlistRef(uid: string, wishlistId: string) {
  const db = adminDb();
  const ref = db.collection("wishlists").doc(wishlistId);
  const snap = await ref.get();
  if (!snap.exists) throw new AuthError("Wishlist entry not found.", 404);
  if ((snap.data() as { userId?: string }).userId !== uid) {
    throw new AuthError("You can only manage your own wishlist entries.", 403);
  }
  return ref;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ wishlistId: string }> }
) {
  try {
    const { wishlistId } = await params;
    const { uid } = await requireAuthenticatedUser(req);
    const ref = await getOwnedWishlistRef(uid, wishlistId);
    await ref.delete();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE /api/wishlists/[wishlistId] failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ wishlistId: string }> }
) {
  try {
    const { wishlistId } = await params;
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const ref = await getOwnedWishlistRef(uid, wishlistId);
    await ref.update({ active: parsed.data.active, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ updated: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/wishlists/[wishlistId] failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
