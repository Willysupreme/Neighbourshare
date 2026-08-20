// One-time project configuration script - NOT part of the running app,
// NOT an API route. TOTP MFA has no toggle in the Firebase Console UI
// (unlike SMS MFA) - it can only be enabled via the Admin SDK or a
// direct REST call to the project config endpoint. Run this once,
// locally, with your existing .env.local Admin SDK credentials already
// in place:
//
//   node scripts/enable-totp-mfa.js
//
// Safe to run more than once (idempotent - just re-sets the same
// config). Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
// and FIREBASE_ADMIN_PRIVATE_KEY to already be set in your environment
// (the same ones the app itself uses server-side).

require("dotenv").config({ path: ".env.local" });
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY in .env.local"
  );
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

async function main() {
  await getAuth().projectConfigManager().updateProjectConfig({
    multiFactorConfig: {
      providerConfigs: [
        {
          state: "ENABLED",
          totpProviderConfig: {
            adjacentIntervals: 5, // Firebase's documented default
          },
        },
      ],
    },
  });
  console.log("TOTP MFA enabled at the project level.");
}

main().catch((err) => {
  console.error("Failed to enable TOTP MFA:", err.message);
  process.exit(1);
});
