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
};

export default nextConfig;
