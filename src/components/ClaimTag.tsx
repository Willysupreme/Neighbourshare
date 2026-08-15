import { BookingState } from "@/types";

const STATE_LABELS: Record<BookingState, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  RESERVED: "Reserved",
  PICKED_UP: "Picked up",
  IN_USE: "In use",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  MAINTENANCE: "Maintenance",
};

// Each state maps to one of the palette's semantic tones.
const STATE_TONE: Record<BookingState, "ochre" | "indigo" | "leaf" | "clay" | "ink"> = {
  REQUESTED: "ochre",
  APPROVED: "indigo",
  RESERVED: "indigo",
  PICKED_UP: "indigo",
  IN_USE: "indigo",
  RETURNED: "leaf",
  COMPLETED: "leaf",
  DECLINED: "clay",
  CANCELLED: "ink",
  MAINTENANCE: "ochre",
};

const TONE_CLASSES: Record<string, string> = {
  ochre: "bg-ochre-light text-ochre border-ochre/30",
  indigo: "bg-indigo-light text-indigo border-indigo/30",
  leaf: "bg-leaf-light text-leaf border-leaf/30",
  clay: "bg-clay-light text-clay border-clay/30",
  ink: "bg-line/40 text-ink/60 border-ink/20",
};

export function ClaimTag({ state, size = "md" }: { state: BookingState; size?: "sm" | "md" }) {
  const tone = STATE_TONE[state];
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`relative inline-flex items-center gap-1 rounded-sm border font-tag font-medium uppercase tracking-wider ${TONE_CLASSES[tone]} ${sizeClasses}`}
      style={{
        // Perforated left edge - a repeating series of tiny paper-color
        // notches, like a ticket torn from a strip.
        backgroundImage:
          "radial-gradient(circle at 0 50%, var(--paper) 2px, transparent 2.5px)",
        backgroundSize: "100% 8px",
        backgroundRepeat: "repeat-y",
        paddingLeft: size === "sm" ? "10px" : "12px",
      }}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
