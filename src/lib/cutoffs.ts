// Rankings-derived entry cutoffs (answering "can draw size + rankings give us
// cutoffs?"). Pure and dependency-light.
//
// Model — concurrent-week allocation: in any given week the strongest-field
// events take the top-ranked players first, so an event's cutoff RANK is the
// cumulative direct-acceptance depth through its tier that week. Direct
// acceptances = draw size − wildcards − qualifiers (fixed per tier). The cutoff
// POINTS then come from the rankings at that rank (the app already maps
// rank → points), so the rank is a pure function of the calendar + draw sizes.
//
// LIMITS: this assumes the week's calendar is COMPLETE and every eligible top
// player enters. With a partial calendar or voluntary skips the raw cumulative
// under-counts, so per-tier FLOORS keep a minor event from looking elite. It is
// accurate for big mandatory events, an estimate for smaller ones — and gets
// better the more complete the calendar feeding it.

import type { Tour } from "@/generated/prisma/enums";
import { circuitForTournament } from "@/lib/circuit";

export interface CalendarEvent {
  key: string; // stable id for the event (name, id, …)
  tour: Tour;
  tier: string;
  drawSize: number;
  startDate: Date;
}

// Wildcards + qualifiers carved out of the main draw per tier (standard 2026
// splits); direct acceptances are what's left.
const ENTRY: Record<string, { wc: number; q: number }> = {
  GRAND_SLAM: { wc: 8, q: 16 },
  MASTERS_1000: { wc: 7, q: 12 },
  WTA_1000: { wc: 7, q: 12 },
  ATP_500: { wc: 3, q: 4 },
  WTA_500: { wc: 4, q: 6 },
  ATP_250: { wc: 3, q: 4 },
  WTA_250: { wc: 3, q: 6 },
  WTA_125: { wc: 3, q: 4 },
  CHALLENGER_125: { wc: 4, q: 6 },
  CHALLENGER_100: { wc: 4, q: 6 },
  ITF_M25: { wc: 4, q: 4 },
  ITF_W25: { wc: 4, q: 4 },
};
const DEFAULT_ENTRY = { wc: 3, q: 4 };

// Direct main-draw acceptances for a tier + draw size.
export function directAcceptances(tier: string, drawSize: number): number {
  const e = ENTRY[tier] ?? DEFAULT_ENTRY;
  return Math.max(1, drawSize - e.wc - e.q);
}

// Field strength order (higher = takes the top players first).
const PRESTIGE: Record<string, number> = {
  GRAND_SLAM: 100,
  MASTERS_1000: 90,
  WTA_1000: 90,
  ATP_500: 80,
  WTA_500: 80,
  ATP_250: 70,
  WTA_250: 70,
  WTA_125: 55,
  CHALLENGER_125: 50,
  CHALLENGER_100: 48,
  ITF_M25: 30,
  ITF_W25: 30,
};
const DEFAULT_PRESTIGE = 40;

// A minor event's field can't realistically be stronger than this rank — top
// players are globally committed to bigger events, which a partial local
// calendar wouldn't otherwise capture.
const FLOOR: Record<string, number> = {
  CHALLENGER_125: 80,
  CHALLENGER_100: 100,
  WTA_125: 150,
  ITF_M25: 300,
  ITF_W25: 300,
};

// Monday (UTC) of the event's week, so same-week events group together.
function weekKey(d: Date): string {
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - sinceMonday * 86_400_000).toISOString().slice(0, 10);
}

// Estimated live-cutoff RANK per event, keyed by CalendarEvent.key.
export function estimateCutoffRanks(events: CalendarEvent[]): Map<string, number> {
  const result = new Map<string, number>();

  // Group by circuit + tournament week — players choose one event per week, and
  // the men's/women's fields don't compete for each other.
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const gk = `${circuitForTournament(e.tour, e.tier)}:${weekKey(e.startDate)}`;
    (groups.get(gk) ?? groups.set(gk, []).get(gk)!).push(e);
  }

  for (const grp of groups.values()) {
    const tiers = [...new Set(grp.map((e) => e.tier))].sort(
      (a, b) => (PRESTIGE[b] ?? DEFAULT_PRESTIGE) - (PRESTIGE[a] ?? DEFAULT_PRESTIGE),
    );
    let running = 0; // players consumed by more prestigious events this week
    for (const tier of tiers) {
      const tierEvents = grp.filter((e) => e.tier === tier);
      // Same-tier events the same week share the pool, so they reach the same
      // depth (combined direct-acceptance slots below what higher tiers took).
      const slots = tierEvents.reduce((s, e) => s + directAcceptances(e.tier, e.drawSize), 0);
      const cutoff = Math.max(running + slots, FLOOR[tier] ?? 0);
      for (const e of tierEvents) result.set(e.key, cutoff);
      running = cutoff;
    }
  }
  return result;
}
