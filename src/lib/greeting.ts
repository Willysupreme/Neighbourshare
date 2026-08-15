/**
 * Time-of-day greeting, following the common real-world convention:
 * morning until noon, afternoon until early evening, evening after that.
 * Kept as a pure function (takes the hour, not `new Date()` directly) so
 * it's trivially unit-testable without mocking the system clock.
 */
export function getTimeBasedGreeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** First name only - keeps the greeting warm and casual, not formal. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}
