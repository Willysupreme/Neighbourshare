// Server-only Firebase Admin SDK initialization.
// NEVER import this file from a "use client" component - it uses the
// service account credential, which must stay server-side only.
// The service account JSON is provided via three separate env vars
// (never committed) - see .env.example.

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Private key is stored with literal \n sequences in the env var; must be
  // unescaped before use.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (server-only env vars)."
    );
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  // Defense-in-depth: even with explicit `?? ""` defaults in each API route,
  // this prevents any future optional field from crashing a write if a
  // developer forgets to default it. Explicit defaults are still preferred
  // where the field matters, since silently dropping a field is its own
  // kind of bug - this setting only guards against the two combining badly.
  getFirestore(app).settings({ ignoreUndefinedProperties: true });

  return app;
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
