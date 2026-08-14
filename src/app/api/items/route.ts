import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { itemSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  try {
    const { uid, profile } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid item details." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const itemRef = db.collection("items").doc();
    const now = FieldValue.serverTimestamp();

    await itemRef.set({
      id: itemRef.id,
      ownerId: uid,
      neighborhoodId: profile.neighborhoodId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      condition: parsed.data.condition,
      pickupInstructions: parsed.data.pickupInstructions ?? "",
      imageUrls: parsed.data.imageUrls ?? [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ itemId: itemRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/items failed:", err);
    return NextResponse.json({ error: "Something went wrong creating the listing." }, { status: 500 });
  }
}
