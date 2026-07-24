// Cutoff estimation engine (BRA-107). Chooses the best basis for an event's
// estimated entry cutoff and tags it so the UI can show confidence (BRA-108).
// Pure + unit-tested.
//
// Basis, best → weakest confidence:
//   "historical"  the event recurs unchanged → use its own prior-edition cutoff
//                 (real once BRA-106 ingest runs; a labeled estimate until then).
//   "adjusted"    the event changed format year-over-year (tier/surface/draw), so
//                 last year's number doesn't apply → use what's typical for its
//                 NEW tier this year.
//   "estimated"   brand-new event with no history → the typical cutoff for its tier.
//
// The "typical for a tier" fallback is the median of same-tier events' historical
// cutoffs — a data-grounded, calibrated stand-in. (The raw concurrent-week model
// in cutoffs.ts runs ~2–3× too strong on absolute rank — see BRA-104 — so it's
// not used for the number here.) All cutoffs stay labeled "estimated".

export type CutoffBasis = "historical" | "adjusted" | "estimated";

export interface EventChange {
  kind: "new" | "changed";
  note: string;
}

// Curated 2026 changes — there's no prior-year data feed yet to auto-detect
// these, so they're recorded from the calendar research (verified via Wikipedia).
// When historical ingestion (BRA-106) lands, this can be derived instead.
export const EVENT_CHANGES: Record<string, EventChange> = {
  "Athens Open (WTA)": { kind: "new", note: "New event this year" },
  "Hall of Fame Open": { kind: "changed", note: "Now a Challenger (was ATP 250)" },
  "Palermo Ladies Open": { kind: "changed", note: "Now WTA 125 (was WTA 250)" },
  "Livesport Prague Open": { kind: "changed", note: "Now hard court (was clay)" },
  "Mubadala Citi DC Open (ATP)": { kind: "changed", note: "Draw cut to 32 (was 48)" },
};

export function changeFor(name: string): EventChange | null {
  return EVENT_CHANGES[name] ?? null;
}

export interface EstimatorEvent {
  key: string; // stable id
  name: string;
  tier: string;
  historicalRank: number | null; // prior-edition cutoff, if known
}

export interface CutoffEstimate {
  rank: number | null;
  basis: CutoffBasis;
  change: EventChange | null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Median historical cutoff of same-tier events (excluding `exceptKey`).
export function tierTypicalCutoff(
  tier: string,
  events: EstimatorEvent[],
  exceptKey?: string,
): number | null {
  const ranks = events
    .filter((e) => e.tier === tier && e.key !== exceptKey && e.historicalRank != null)
    .map((e) => e.historicalRank!);
  return median(ranks);
}

// Estimate one event's cutoff, given the full set (for the tier-typical fallback).
export function estimateCutoff(event: EstimatorEvent, all: EstimatorEvent[]): CutoffEstimate {
  const change = changeFor(event.name);

  if (change?.kind === "changed") {
    // Own history is for a different format; use the typical for its new tier,
    // falling back to its stored number if that tier has no other events.
    return {
      rank: tierTypicalCutoff(event.tier, all, event.key) ?? event.historicalRank,
      basis: "adjusted",
      change,
    };
  }
  if (change?.kind === "new") {
    return { rank: tierTypicalCutoff(event.tier, all, event.key), basis: "estimated", change };
  }
  if (event.historicalRank != null) {
    return { rank: event.historicalRank, basis: "historical", change: null };
  }
  // No history and not flagged (e.g. a fresh event we didn't tag) → tier-typical.
  return { rank: tierTypicalCutoff(event.tier, all, event.key), basis: "estimated", change: null };
}

export function estimateCutoffs(events: EstimatorEvent[]): Map<string, CutoffEstimate> {
  return new Map(events.map((e) => [e.key, estimateCutoff(e, events)]));
}
