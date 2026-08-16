// Detects whether the app is currently running in local development
// (as opposed to a deployed environment, including Vercel preview
// deployments, which get the same COOP header as production - see
// REBUILD_DOCUMENTATION/AUTH_AUDIT.md for the verified reasoning behind
// keying this off the actual runtime origin rather than NODE_ENV, which
// would be "production" for a local build too and apply the wrong
// strategy there.
export function isLocalDevelopment(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}
