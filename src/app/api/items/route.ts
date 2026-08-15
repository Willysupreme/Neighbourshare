import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { itemSchema } from "@/lib/validation/schemas";
import { logAuditEntry } from "@/lib/auditLog";
import { notify } from "@/lib/notificationEngine";
import { matchesWishlist } from "@/lib/wishlistMatching";
import { haversineDistanceKm } from "@/lib/neighborhoods/distance";
import { Neighborhood, Wishlist } from "@/types";

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

    // Admin-assisted listing: admins can list on behalf of anyone;
    // representatives can only do so for residents of their own
    // neighbourhood (checked below, not just assumed from the client).
    let ownerId = uid;
    let ownerNeighborhoodId = profile.neighborhoodId;
    let onBehalfOf: string | undefined;

    const rawOnBehalfOf = typeof body.onBehalfOfUserId === "string" ? body.onBehalfOfUserId : undefined;
    if (rawOnBehalfOf && (profile.role === "admin" || profile.role === "representative")) {
      const targetSnap = await db.collection("users").doc(rawOnBehalfOf).get();
      if (!targetSnap.exists) {
        return NextResponse.json({ error: "That user could not be found." }, { status: 404 });
      }
      const target = targetSnap.data() as { neighborhoodId?: string };
      if (profile.role === "representative" && target.neighborhoodId !== profile.neighborhoodId) {
        throw new AuthError("Representatives can only list items for residents of their own neighbourhood.", 403);
      }
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

    // Wishlist matching (best-effort, non-blocking to the listing itself -
    // a failure here should never prevent the item from being created).
    try {
      await matchWishlistsForNewItem(db, {
        id: itemRef.id,
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category,
        neighborhoodId: ownerNeighborhoodId,
      });
    } catch (matchErr) {
      console.error("Wishlist matching failed (non-fatal):", matchErr);
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

/**
 * Checks every active wishlist against a newly-created item, notifying
 * owners whose category/keyword criteria match AND whose neighborhood is
 * within their chosen radius of the item's neighborhood. Full collection
 * scans here are an accepted MVP-scale tradeoff (same reasoning as the
 * booking-overlap query - see Technical_Debt_Plan) - fine for dozens of
 * wishlists, would need a geo-index at real scale.
 */
async function matchWishlistsForNewItem(
  db: FirebaseFirestore.Firestore,
  item: { id: string; name: string; description: string; category: string; neighborhoodId: string }
) {
  const [wishlistsSnap, itemNeighborhoodSnap] = await Promise.all([
    db.collection("wishlists").where("active", "==", true).get(),
    db.collection("neighborhoods").doc(item.neighborhoodId).get(),
  ]);
  if (wishlistsSnap.empty || !itemNeighborhoodSnap.exists) return;

  const itemNeighborhood = itemNeighborhoodSnap.data() as Neighborhood;
  if (itemNeighborhood.latitude == null || itemNeighborhood.longitude == null) return;

  for (const wishlistDoc of wishlistsSnap.docs) {
    const wishlist = wishlistDoc.data() as Wishlist;
    if (wishlist.notifiedItemIds?.includes(item.id)) continue;

    const matches = matchesWishlist(
      { name: item.name, description: item.description, category: item.category as never },
      { category: wishlist.category, keyword: wishlist.keyword }
    );
    if (!matches) continue;

    const ownerSnap = await db.collection("users").doc(wishlist.userId).get();
    if (!ownerSnap.exists) continue;
    const owner = ownerSnap.data() as {
      neighborhoodId?: string;
      name?: string;
      wishlistNotificationsEnabled?: boolean;
    };
    if (!owner.neighborhoodId) continue;

    const ownerNeighborhoodSnap = await db.collection("neighborhoods").doc(owner.neighborhoodId).get();
    if (!ownerNeighborhoodSnap.exists) continue;
    const ownerNeighborhood = ownerNeighborhoodSnap.data() as Neighborhood;
    if (ownerNeighborhood.latitude == null || ownerNeighborhood.longitude == null) continue;

    const distanceKm = haversineDistanceKm(
      ownerNeighborhood.latitude,
      ownerNeighborhood.longitude,
      itemNeighborhood.latitude,
      itemNeighborhood.longitude
    );
    if (distanceKm > wishlist.radiusKm) continue;

    // Notification preference (P1): a user can keep a wishlist active
    // (still tracked, still deduped) while opting out of the alert itself.
    // Defaults to enabled when the field has never been set.
    if (owner.wishlistNotificationsEnabled !== false) {
      await notify(db, {
        userId: wishlist.userId,
        type: "wishlist_match",
        message: `Wishlist alert: "${item.name}" is now available approximately ${distanceKm.toFixed(1)}km away.`,
      });
    }

    await wishlistDoc.ref.update({
      notifiedItemIds: FieldValue.arrayUnion(item.id),
    });
  }
}
