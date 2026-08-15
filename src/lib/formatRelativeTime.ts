// Accepts either a real ISO string or a Firestore Timestamp object.
// Firestore fields typed `string` in this codebase's domain types (for
// convenience, matching what they become after JSON serialisation) are
// actually Timestamp objects at runtime when read directly from a
// client-SDK snapshot - this bit a real admin-dashboard bug earlier in
// the project (Timestamp passed to `new Date()` silently produces
// "Invalid Date"). Fixed here at the root so every caller is protected,
// not just the one call site that happened to surface it.
type TimestampLike = string | { toDate: () => Date } | null | undefined;

function toEpochMs(value: TimestampLike): number {
  if (!value) return Date.now();
  if (typeof value === "string") return new Date(value).getTime();
  return value.toDate().getTime();
}

export function formatRelativeTime(iso: TimestampLike, now: number = Date.now()): string {
  const diffMs = now - toEpochMs(iso);
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
