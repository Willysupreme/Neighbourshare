import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";

const bodySchema = z
  .object({
    verificationMethod: z.enum(["plus_code", "geolocation", "manual_notes"]),
    plusCode: z.string().trim().max(20).optional(),
    // Coordinates must already be fuzzed client-side before they ever
    // reach this API route - see fuzzCoordinates() in
    // src/lib/neighborhoods/distance.ts. This route does not re-fuzz,
    // it trusts the client did so, consistent with how the booking
    // location-sharing feature already works.
    approximateLatitude: z.number().optional(),
    approximateLongitude: z.number().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) =>
      (d.verificationMethod === "plus_code" && !!d.plusCode) ||
      (d.verificationMethod === "geolocation" && d.approximateLatitude != null && d.approximateLongitude != null) ||
      (d.verificationMethod === "manual_notes" && !!d.notes),
    { message: "Provide the information matching your chosen verification method." }
  );

export async function POST(req: NextRequest) {
  try {
    const { uid, profile } = await requireAuthenticatedUser(req);

    if (!profile.neighborhoodId) {
      return NextResponse.json({ error: "Select a neighborhood first." }, { status: 400 });
    }
    if (profile.verificationStatus === "verified") {
      return NextResponse.json({ error: "You're already verified." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const neighborhoodSnap = await db.collection("neighborhoods").doc(profile.neighborhoodId).get();
    if (!neighborhoodSnap.exists) {
      return NextResponse.json({ error: "Neighborhood not found." }, { status: 404 });
    }
    const neighborhoodName = (neighborhoodSnap.data() as { name?: string }).name ?? profile.neighborhoodId;

    const ref = db.collection("neighbourhoodVerificationRequests").doc();
    await ref.set({
      id: ref.id,
      userId: uid,
      userName: profile.name,
      neighborhoodId: profile.neighborhoodId,
      neighborhoodName,
      verificationMethod: parsed.data.verificationMethod,
      plusCode: parsed.data.plusCode ?? null,
      approximateLatitude: parsed.data.approximateLatitude ?? null,
      approximateLongitude: parsed.data.approximateLongitude ?? null,
      notes: parsed.data.notes ?? null,
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("users").doc(uid).update({
      verificationStatus: "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ requestId: ref.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/verification-requests failed:", err);
    return NextResponse.json({ error: "Something went wrong submitting your request." }, { status: 500 });
  }
}
