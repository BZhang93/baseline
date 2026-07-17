// Client-safe (no DB import): a player can only play one tournament at a time,
// so a schedule is a chronological, non-overlapping path. These helpers resolve
// the played path and surface same-week conflicts, so totals/legs never sum
// simultaneous events (player-feedback P0-1).

export interface DatedEvent {
  startDate: Date;
  endDate: Date;
}

// Two events collide if their date ranges intersect (inclusive) — i.e. they'd
// require being in two places the same week.
export function eventsOverlap(a: DatedEvent, b: DatedEvent): boolean {
  return a.startDate.getTime() <= b.endDate.getTime() && b.startDate.getTime() <= a.endDate.getTime();
}

// Greedy chronological resolution: sort by start date, keep an event when it
// doesn't overlap the last kept one, otherwise it's a conflict. Deterministic
// and stable; the optimizer (BRA-62) handles *which* event is best to keep.
export function resolvePlayedPath<T extends DatedEvent>(events: T[]): {
  path: T[];
  conflicts: T[];
} {
  const sorted = [...events].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const path: T[] = [];
  const conflicts: T[] = [];
  for (const e of sorted) {
    const last = path[path.length - 1];
    if (last && eventsOverlap(last, e)) conflicts.push(e);
    else path.push(e);
  }
  return { path, conflicts };
}

// Does `candidate` collide with any event in `selected`? Used at add-time to
// prevent booking two events in the same week.
export function conflictsWith(candidate: DatedEvent, selected: DatedEvent[]): boolean {
  return selected.some((s) => eventsOverlap(candidate, s));
}

// The min start → max end span of a set of events, so a schedule can show its
// real date range instead of "No dates set" (player-feedback P2-9).
export function eventsDateRange<T extends DatedEvent>(
  events: T[],
): { start: Date | null; end: Date | null } {
  if (events.length === 0) return { start: null, end: null };
  let start = events[0].startDate.getTime();
  let end = events[0].endDate.getTime();
  for (const e of events) {
    start = Math.min(start, e.startDate.getTime());
    end = Math.max(end, e.endDate.getTime());
  }
  return { start: new Date(start), end: new Date(end) };
}
