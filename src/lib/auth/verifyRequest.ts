import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { AppUser } from "@/types";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token in the Authorization: Bearer <token> header
 * and returns the caller's uid plus their Firestore user profile.
 *
 * This is the server-side authorization boundary referenced in §23 of the
 * project spec - client-side role checks are a UX convenience only, and
 * every privileged API route must re-verify identity and status here
 * rather than trusting anything the client claims.
 */
export async function requireAuthenticatedUser(
  req: NextRequest
): Promise<{ uid: string; profile: AppUser }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new AuthError("Missing or malformed Authorization header.");
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(match[1]);
  } catch {
    throw new AuthError("Invalid or expired session. Please log in again.");
  }

  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  if (!snap.exists) {
    throw new AuthError("User profile not found.", 404);
  }

  const profile = snap.data() as AppUser;
  if (profile.accountStatus !== "active") {
    throw new AuthError("This account has been suspended.", 403);
  }

  return { uid: decoded.uid, profile };
}

export function requireAdmin(profile: AppUser) {
  if (profile.role !== "admin") {
    throw new AuthError("Administrator privileges are required for this action.", 403);
  }
}
