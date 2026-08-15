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
};

export default nextConfig;
