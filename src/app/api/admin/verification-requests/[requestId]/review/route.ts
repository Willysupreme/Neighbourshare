import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, AuthError } from "@/lib/auth/verifyRequest";
import { notify } from "@/lib/notificationEngine";
import { logAuditEntry } from "@/lib/auditLog";
import { NeighborhoodVerificationRequest } from "@/types";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const { uid, profile } = await requireAuthenticatedUser(req);

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = adminDb();
    const reqRef = db.collection("neighbourhoodVerificationRequests").doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    const request = snap.data() as NeighborhoodVerificationRequest;

    // Rebuild Phase 10: brief §19 requires "admin/neighbourhood
    // representative review" - previously this route was admin-only.
    // A representative may review requests, but only for their own
    // neighbourhood, mirroring the existing admin-assisted-listing
    // scoping pattern elsewhere in the codebase (never a representative's
    // own self-judgement of an unrelated area).
    const isRepresentativeForThisRequest =
      profile.role === "representative" && request.neighborhoodId === profile.neighborhoodId;
    if (profile.role !== "admin" && !isRepresentativeForThisRequest) {
      throw new AuthError("You are not authorised to review this verification request.", 403);
    }

    if (request.status !== "PENDING" && request.status !== "UNDER_REVIEW") {
      throw new AuthError("This request has already been reviewed.", 409);
    }

    const newStatus = parsed.data.decision === "approved" ? "APPROVED" : "REJECTED";
    const now = FieldValue.serverTimestamp();

    await reqRef.update({
      status: newStatus,
      reviewedBy: uid,
      reviewedByName: profile.name,
      reviewedAt: now,
      reviewNotes: parsed.data.reviewNotes ?? null,
    });

    await db.collection("users").doc(request.userId).update({
      verificationStatus: newStatus === "APPROVED" ? "verified" : "unverified",
      updatedAt: now,
    });

    await notify(db, {
      userId: request.userId,
      type: "verification_update",
      message:
        newStatus === "APPROVED"
          ? `Your verification request for ${request.neighborhoodName} was approved.`
          : `Your verification request for ${request.neighborhoodName} was not approved. You can try the verification code instead, or submit a new request.`,
    });

    await logAuditEntry(db, {
      actorId: uid,
      actorName: profile.name,
      action: newStatus === "APPROVED" ? "verification_request_approved" : "verification_request_rejected",
      targetType: "user",
      targetId: request.userId,
      details: `${profile.name} ${newStatus === "APPROVED" ? "approved" : "rejected"} ${request.userName}'s verification request for ${request.neighborhoodName}`,
    });

    return NextResponse.json({ requestId, status: newStatus });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/admin/verification-requests/[requestId]/review failed:", err);
    return NextResponse.json({ error: "Something went wrong reviewing this request." }, { status: 500 });
  }
}
