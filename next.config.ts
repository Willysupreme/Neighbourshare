import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin is a complex Node.js-only package (native-ish module
  // resolution, dynamic requires) that Next.js's bundler frequently fails
  // to package correctly into serverless functions without this - the
  // exact symptom is a 500 with "Failed to load external module
  // firebase-admin-<hash>" and no JSON body, since the crash happens at
  // module load time, before our own route handler (and its try/catch)
  // ever runs.
  serverExternalPackages: ["firebase-admin", "jwks-rsa", "jose"],
  // Note: externalizing firebase-admin alone was NOT sufficient. Its
  // transitive dependency chain (firebase-admin -> jwks-rsa -> jose) still
  // got bundled by webpack, and `jose` is a "type": "module" (ESM-only)
  // package - webpack's server bundle uses require() at runtime, and
  // require()-ing an ESM module throws "require() of ES Module ... not
  // supported", confirmed via Vercel's own runtime logs. Externalizing the
  // whole chain, not just the top-level package, lets Node's native
  // module resolution handle them correctly instead of webpack's bundling.

  // Explicit Cross-Origin-Opener-Policy, permissive enough for
  // signInWithPopup's window.closed detection to work correctly. Verified
  // via curl that Next.js's own build output (dev or a local production
  // build/start) never set a COOP header at all - the console warnings
  // seen during local Google sign-in testing
  // ("Cross-Origin-Opener-Policy policy would block the window.close
  // call.") were traced to Firebase's own popup.ts and Google's own
  // gapi.loaded script, not to any header this app was setting, and were
  // never the actual thrown exception - every real failure captured was
  // "Database is closing/hidden" (root cause: a redundant
  // getRedirectResult() call, fixed separately). This header is added as
  // correct, standard defense-in-depth regardless - it matters if popup-
  // based sign-in is ever used in a deployed environment (currently only
  // local dev uses popup; production uses signInWithRedirect
  // specifically to avoid Vercel's platform-level default COOP header,
  // which this app-level header does not control or override).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
