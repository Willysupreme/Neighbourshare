import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { itemSchema } from "@/lib/validation/schemas";
import { logAuditEntry } from "@/lib/auditLog";

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

    // Admin-assisted listing: only an admin may pass onBehalfOfUserId, and
    // only admins reach this branch - a non-admin body containing this
    // field is silently ignored below, never trusted from the client.
    let ownerId = uid;
    let ownerNeighborhoodId = profile.neighborhoodId;
    let onBehalfOf: string | undefined;

    const rawOnBehalfOf = typeof body.onBehalfOfUserId === "string" ? body.onBehalfOfUserId : undefined;
    if (rawOnBehalfOf && profile.role === "admin") {
      const targetSnap = await db.collection("users").doc(rawOnBehalfOf).get();
      if (!targetSnap.exists) {
        return NextResponse.json({ error: "That user could not be found." }, { status: 404 });
      }
      const target = targetSnap.data() as { neighborhoodId?: string };
      ownerId = rawOnBehalfOf;
      ownerNeighborhoodId = target.neighborhoodId ?? profile.neighborhoodId;
      onBehalfOf = rawOnBehalfOf;
    }

    const itemRef = db.collection("items").doc();
    const now = FieldValue.serverTimestamp();

    await itemRef.set({
      id: itemRef.id,
      ownerId,
      neighborhoodId: ownerNeighborhoodId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      condition: parsed.data.condition,
      pickupInstructions: parsed.data.pickupInstructions ?? "",
      imageUrls: parsed.data.imageUrls ?? [],
      status: "active",
      createdBy: uid,
      updatedBy: uid,
      createdOnBehalfOf: onBehalfOf ?? null,
      createdAt: now,
      updatedAt: now,
    });

    if (onBehalfOf) {
      await logAuditEntry(db, {
        actorId: uid,
        actorName: profile.name,
        action: "item_created_on_behalf_of_owner",
        targetType: "item",
        targetId: itemRef.id,
        details: `${profile.name} listed "${parsed.data.name}" on behalf of user ${onBehalfOf}`,
      });
    }

    return NextResponse.json({ itemId: itemRef.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/items failed:", err);
    return NextResponse.json({ error: "Something went wrong creating the listing." }, { status: 500 });
  }
}
