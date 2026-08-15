import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin is a complex Node.js-only package (native-ish module
  // resolution, dynamic requires) that Next.js's bundler frequently fails
  // to package correctly into serverless functions without this - the
  // exact symptom is a 500 with "Failed to load external module
  // firebase-admin-<hash>" and no JSON body, since the crash happens at
  // module load time, before our own route handler (and its try/catch)
  // ever runs.
  serverExternalPackages: ["firebase-admin"],
  // Note: this alone wasn't sufficient - Turbopack's support for cleanly
  // externalizing complex packages like firebase-admin is still
  // incomplete (confirmed via Vercel's own runtime logs: "Failed to load
  // external module firebase-admin-<hash>", persisting even with this
  // setting in place). The actual fix is forcing production builds to use
  // webpack instead (see the "build" script in package.json: "next build
  // --webpack"), which has mature, reliable support for this. Dev mode
  // keeps using Turbopack (default, untouched) since it was never the
  // problem and is faster for local iteration.
};

export default nextConfig;
