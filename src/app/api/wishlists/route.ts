import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";

const bodySchema = z
  .object({
    category: z
      .enum(["power_tools", "hand_tools", "lawn_garden", "cleaning", "ladders_access", "other"])
      .optional(),
    keyword: z.string().trim().max(80).optional(),
    radiusKm: z.number().min(0.5).max(50),
  })
  .refine((d) => !!d.category || !!d.keyword, {
    message: "Add a category, a keyword, or both.",
  });

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid wishlist entry." },
        { status: 400 }
      );
    }

    const db = adminDb();

    // Prevent near-duplicate wishlist entries for the same person - same
    // category + keyword pair, still active.
    const existing = await db
      .collection("wishlists")
      .where("userId", "==", uid)
      .where("active", "==", true)
      .get();
    const isDuplicate = existing.docs.some((d) => {
      const w = d.data();
      return (
        (w.category ?? null) === (parsed.data.category ?? null) &&
        (w.keyword ?? "").toLowerCase() === (parsed.data.keyword ?? "").toLowerCase()
      );
    });
    if (isDuplicate) {
      return NextResponse.json({ error: "You already have a matching wishlist entry." }, { status: 409 });
    }

    const ref = db.collection("wishlists").doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({
      id: ref.id,
      userId: uid,
      category: parsed.data.category ?? null,
      keyword: parsed.data.keyword ?? null,
      radiusKm: parsed.data.radiusKm,
      active: true,
      notifiedItemIds: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ wishlistId: ref.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/wishlists failed:", err);
    return NextResponse.json({ error: "Something went wrong saving your wishlist entry." }, { status: 500 });
  }
}
