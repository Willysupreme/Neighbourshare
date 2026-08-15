import { NextResponse } from "next/server";

/**
 * Temporary diagnostic route - see the forensic debugging investigation
 * in the commit history. Isolates exactly where a firebase-admin failure
 * occurs: module resolution, app initialization, or Firestore specifically.
 * Never exposes credential values, only booleans/version strings.
 *
 * Safe to delete once the root cause is confirmed and fixed.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    nodeVersion: process.version,
    moduleLoaded: false,
    adminInitialized: false,
    firestoreInitialized: false,
    firestoreReadAttempted: false,
    error: null as string | null,
    errorStage: null as string | null,
  };

  try {
    // Stage 1: can the module even be resolved/required at runtime?
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    result.moduleLoaded = true;

    // Stage 3: can we initialize the app (credentials present + parseable)?
    try {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

      result.envVarsPresent = {
        FIREBASE_ADMIN_PROJECT_ID: !!projectId,
        FIREBASE_ADMIN_CLIENT_EMAIL: !!clientEmail,
        FIREBASE_ADMIN_PRIVATE_KEY: !!privateKey,
      };

      if (!projectId || !clientEmail || !privateKey) {
        result.errorStage = "env-vars-missing";
        result.error = "One or more FIREBASE_ADMIN_* environment variables are not set in this environment.";
        return NextResponse.json(result, { status: 200 });
      }

      const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      result.adminInitialized = true;

      // Stage 4: can we get a Firestore instance and attempt a trivial read?
      const { getFirestore } = await import("firebase-admin/firestore");
      const db = getFirestore(app);
      result.firestoreInitialized = true;

      result.firestoreReadAttempted = true;
      // Avoid writing/reading any collection entirely (sidesteps reserved-
      // name pitfalls like the "__health_check__" one this route
      // originally hit) - listCollections() on a Firestore instance is
      // enough to prove the connection and credentials actually work
      // end-to-end, without touching application data at all.
      await db.listCollections();
    } catch (initErr) {
      result.errorStage = result.adminInitialized ? "firestore" : "admin-init";
      result.error = initErr instanceof Error ? initErr.message : String(initErr);
    }
  } catch (loadErr) {
    result.errorStage = "module-load";
    result.error = loadErr instanceof Error ? loadErr.message : String(loadErr);
  }

  return NextResponse.json(result, { status: 200 });
}
