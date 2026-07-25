import type { GapView } from "@/lib/tournaments";

// Deterministic acceptance badge (PRD §6.3.1): In / Borderline / Out, or a
// neutral "Cutoff N/A" when the gap can't be computed (no cutoff data). Ranking
// is required at onboarding, so "unknown" means missing cutoff data, not a
// missing ranking (BRA-88).
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
          : "Cutoff N/A";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${styles[gap.status]}`}>
      {label}
    </span>
  );
}
