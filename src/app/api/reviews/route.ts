import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { reviewSchema } from "@/lib/validation/schemas";
import { calculateTrustScore } from "@/lib/trust/trustScore";
import { Booking, Review, AppUser } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid review." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const bookingRef = db.collection("bookings").doc(parsed.data.bookingId);

    const result = await db.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new AuthError("Booking not found.", 404);
      const booking = bookingSnap.data() as Booking;

      if (booking.state !== "COMPLETED") {
        throw new AuthError("Reviews can only be left after a booking is completed.", 409);
      }
      if (booking.ownerId !== uid && booking.borrowerId !== uid) {
        throw new AuthError("You are not a party to this booking.", 403);
      }

      const revieweeId = uid === booking.ownerId ? booking.borrowerId : booking.ownerId;

      // Prevent duplicate reviews for the same booking by the same reviewer.
      const existingSnap = await tx.get(
        db
          .collection("reviews")
          .where("bookingId", "==", parsed.data.bookingId)
          .where("reviewerId", "==", uid)
      );
      if (!existingSnap.empty) {
        throw new AuthError("You've already reviewed this booking.", 409);
      }

      const revieweeRef = db.collection("users").doc(revieweeId);
      const revieweeSnap = await tx.get(revieweeRef);
      const reviewee = revieweeSnap.data() as AppUser;

      // Gather this reviewee's existing ratings to recompute their trust score.
      const revieweeReviewsSnap = await tx.get(
        db.collection("reviews").where("revieweeId", "==", revieweeId)
      );
      const priorRatings = revieweeReviewsSnap.docs.map((d) => (d.data() as Review).rating);
      const newTrustScore = calculateTrustScore({
        ratings: [...priorRatings, parsed.data.rating],
        isVerified: reviewee.verificationStatus === "verified",
        completedTransactions: (reviewee.completedTransactions ?? 0) + 1,
      });

      const reviewRef = db.collection("reviews").doc();
      const now = FieldValue.serverTimestamp();
      tx.set(reviewRef, {
        id: reviewRef.id,
        bookingId: parsed.data.bookingId,
        reviewerId: uid,
        revieweeId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? "",
        createdAt: now,
      });

      tx.update(revieweeRef, {
        trustScore: newTrustScore,
        completedTransactions: FieldValue.increment(1),
        updatedAt: now,
      });

      return { reviewId: reviewRef.id };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/reviews failed:", err);
    return NextResponse.json({ error: "Something went wrong submitting the review." }, { status: 500 });
  }
}
