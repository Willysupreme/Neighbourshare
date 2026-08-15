import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import { isRangeAvailable } from "@/lib/booking/overlap";
import { notifyInTransaction } from "@/lib/notificationEngine";
import { Booking, Item } from "@/types";

/**
 * Concurrency strategy (documented per §14):
 *
 * A naive "read availability, then write booking" sequence has a race
 * window: two borrowers could both read "available" before either has
 * written their booking. We close that window by performing the
 * availability re-check AND the booking write inside a single Firestore
 * transaction. Firestore transactions use optimistic concurrency control -
 * if any document read inside the transaction changes before it commits,
 * the whole transaction is retried automatically by the SDK. Because we
 * read every existing blocking booking for the item as part of the
 * transaction, a concurrent write to any of those bookings forces a retry,
 * so the second writer's transaction re-evaluates availability against the
 * first writer's now-committed booking and correctly rejects the overlap.
 *
 * Documented limitation (Technical_Debt_Plan.pdf, NS-TD-03): this
 * transaction reads the *existing* bookings collection for the item but
 * does not use a Firestore composite index/range query fully optimized for
 * large booking volumes; for the MVP's expected neighborhood-scale volume
 * (dozens, not thousands, of bookings per item) a full collection query
 * scoped to itemId is acceptable. This is flagged as Medium priority
 * technical debt, not a correctness bug - the transaction still correctly
 * prevents double-booking regardless of collection size, it is a
 * performance/scaling concern only.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, profile } = await requireAuthenticatedUser(req);

    if (profile.verificationStatus !== "verified") {
      return NextResponse.json(
        { error: "Please complete neighborhood verification before requesting items." },
        { status: 403 }
      );
    }

    // Rebuild Phase 16: AccountRestriction enforcement.
    if (profile.activeRestrictions?.includes("cannot_book")) {
      return NextResponse.json(
        { error: "Your account is currently restricted from creating new booking requests." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = bookingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid booking request." },
        { status: 400 }
      );
    }
    const { itemId, startDate, endDate, note } = parsed.data;

    const db = adminDb();
    const itemRef = db.collection("items").doc(itemId);
    const bookingsRef = db.collection("bookings");
    const newBookingRef = bookingsRef.doc();

    const result = await db.runTransaction(async (tx) => {
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists) {
        throw new AuthError("Item not found.", 404);
      }
      const item = itemSnap.data() as Item;

      if (item.status !== "active") {
        throw new AuthError("This item is not currently available for borrowing.", 409);
      }
      if (item.ownerId === uid) {
        throw new AuthError("You cannot request to borrow your own item.", 400);
      }

      // Trust & Moderation: a block in either direction stops new booking
      // requests between the two parties. Checked inside the transaction
      // for the same consistency guarantee as the availability check, even
      // though blocks are read-only here (no race to protect against, just
      // keeping all the request's validation in one place).
      const [blockedByOwner, blockedOwner] = await Promise.all([
        tx.get(db.collection("blocks").doc(`${item.ownerId}_${uid}`)),
        tx.get(db.collection("blocks").doc(`${uid}_${item.ownerId}`)),
      ]);
      if (blockedByOwner.exists || blockedOwner.exists) {
        throw new AuthError("This item's owner isn't available to receive requests from you.", 403);
      }

      const ownerSnap = await tx.get(db.collection("users").doc(item.ownerId));
      const ownerData = ownerSnap.exists ? (ownerSnap.data() as { name?: string; restrictToVerifiedRequesters?: boolean }) : {};
      const ownerName = ownerData.name ?? "Neighbor";

      // Messaging Preferences: an owner can opt into only accepting
      // requests from verified neighbours. profile.verificationStatus is
      // already re-checked above (blocks unverified users entirely), so
      // this only adds a real restriction once that basic gate is
      // eventually loosened - documented now so the behavior is correct
      // either way.
      if (ownerData.restrictToVerifiedRequesters && profile.verificationStatus !== "verified") {
        throw new AuthError("This owner only accepts requests from verified neighbours.", 403);
      }

      // Read all bookings for this item inside the transaction so a
      // concurrent write to any of them forces this transaction to retry.
      const existingSnap = await tx.get(bookingsRef.where("itemId", "==", itemId));
      const existingBookings = existingSnap.docs.map((d) => d.data() as Booking);

      const availability = isRangeAvailable({ startDate, endDate }, existingBookings);
      if (!availability.available) {
        throw new AuthError(
          "This item is unavailable during the selected period.",
          409
        );
      }

      const now = FieldValue.serverTimestamp();
      const newBooking: Omit<Booking, "createdAt" | "updatedAt"> & {
        createdAt: FirebaseFirestore.FieldValue;
        updatedAt: FirebaseFirestore.FieldValue;
      } = {
        id: newBookingRef.id,
        itemId,
        ownerId: item.ownerId,
        borrowerId: uid,
        neighborhoodId: item.neighborhoodId,
        startDate,
        endDate,
        note: note ?? "",
        state: "REQUESTED",
        conditionBefore: item.condition,
        itemName: item.name,
        ownerName,
        borrowerName: profile.name,
        borrowerTrustScore: profile.trustScore,
        borrowerVerified: profile.verificationStatus === "verified",
        createdAt: now,
        updatedAt: now,
      };

      tx.set(newBookingRef, newBooking);

      notifyInTransaction(db, tx, {
        userId: item.ownerId,
        type: "request_received",
        message: `New borrow request for "${item.name}" (${startDate} to ${endDate}).`,
        relatedBookingId: newBookingRef.id,
      });

      return { bookingId: newBookingRef.id };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/bookings failed:", err);
    return NextResponse.json({ error: "Something went wrong creating the booking." }, { status: 500 });
  }
}
