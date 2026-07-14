import type { GapView } from "@/lib/tournaments";

// Deterministic acceptance badge (PRD §6.3.1): In / Borderline / Out, or a
// prompt to set a ranking when the player's gap can't be computed.
export function GapBadge({ gap }: { gap: GapView }) {
  const styles: Record<GapView["status"], string> = {
    in: "bg-green-100 text-green-800",
    borderline: "bg-amber-100 text-amber-800",
    out: "bg-red-100 text-red-800",
    unknown: "bg-gray-100 text-gray-600",
  };
  const label =
    gap.status === "in"
      ? "You're in"
      : gap.status === "borderline"
        ? `Borderline · ${gap.spots} spots`
        : gap.status === "out"
          ? `${gap.spots} spots${gap.points != null ? ` · ${gap.points} pts` : ""} short`
          : "Set ranking";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[gap.status]}`}>
      {label}
    </span>
  );
}
