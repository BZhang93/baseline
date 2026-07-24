import type { EventChange } from "@/lib/cutoff-estimate";

// Flags an event that's new or changed format this year (BRA-108), so a player
// knows its cutoff estimate is less grounded than a stable recurring event's.
// The note explains the change on hover.
export function ChangeBadge({ change }: { change: EventChange | null }) {
  if (!change) return null;
  const isNew = change.kind === "new";
  return (
    <span
      title={`${change.note} — cutoff is a rougher estimate`}
      className={`rounded px-2 py-0.5 text-xs ${
        isNew ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {isNew ? "New this year" : "Changed this year"}
    </span>
  );
}
