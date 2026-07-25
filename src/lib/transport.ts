// Multi-modal per-leg travel router (player-feedback P1-7). Pure and
// dependency-free (like travel.ts) so it runs in client components, the create
// form's live preview, and the server-side schedule builder alike.
//
// The philosophy: reality picks the mode, preference breaks ties. We never
// recommend a preferred-but-absurd option (an 11h train when a 2h flight
// exists), and we never fly a short hop a train wins outright. Heuristic
// per-mode estimators stand in for a real routing API — swap `MODE_MODELS`
// for live data later without touching the selection logic.

import { TransportMode } from "@/generated/prisma/enums";
import { formatMoney, formatTravelTime, formatTransportMode } from "@/lib/format";

export const ALL_TRANSPORT_MODES: TransportMode[] = [
  TransportMode.FLIGHT,
  TransportMode.TRAIN,
  TransportMode.CAR,
  TransportMode.BUS,
  TransportMode.RIDESHARE,
];

// How the Priority toggle steers mode choice:
//  - "time"     Protect body → fastest option (most rest before sign-in)
//  - "cost"     Maximize points → cheapest option (frees budget for more events)
//  - "balanced" weighted trade-off of the two
export type TransportPriority = "time" | "cost" | "balanced";

interface ModeModel {
  speedKmh: number; // effective door-to-door speed
  costPerKm: number; // rough per-km fare/fuel in the schedule's currency units
  overheadMin: number; // fixed time (airport/station/boarding) added per trip
  ground: boolean; // true = road/rail, gated out beyond GROUND_MAX_KM
}

// Straight-line distance is shorter than the road/rail a ground trip follows;
// inflate ground legs so estimates aren't optimistic.
const GROUND_CIRCUITY = 1.3;
// Beyond this straight-line distance, ground travel stops being realistic
// (multi-day drives, trans-oceanic hops) — only flying remains feasible.
const GROUND_MAX_KM = 1200;

const MODE_MODELS: Record<TransportMode, ModeModel> = {
  [TransportMode.FLIGHT]: { speedKmh: 800, costPerKm: 0.15, overheadMin: 120, ground: false },
  [TransportMode.TRAIN]: { speedKmh: 120, costPerKm: 0.2, overheadMin: 30, ground: true },
  [TransportMode.CAR]: { speedKmh: 90, costPerKm: 0.25, overheadMin: 15, ground: true },
  [TransportMode.BUS]: { speedKmh: 70, costPerKm: 0.08, overheadMin: 20, ground: true },
  [TransportMode.RIDESHARE]: { speedKmh: 90, costPerKm: 0.45, overheadMin: 10, ground: true },
};

export interface ModeEstimate {
  mode: TransportMode;
  durationMinutes: number;
  costEstimate: number;
}

// Time + cost for one mode over a straight-line distance.
export function estimateMode(distanceKm: number, mode: TransportMode): ModeEstimate {
  const m = MODE_MODELS[mode];
  const dist = m.ground ? distanceKm * GROUND_CIRCUITY : distanceKm;
  return {
    mode,
    durationMinutes: Math.round((dist / m.speedKmh) * 60 + m.overheadMin),
    costEstimate: Math.round(dist * m.costPerKm),
  };
}

// Whether a mode is physically sensible for a leg of this distance.
export function modeFeasible(distanceKm: number, mode: TransportMode): boolean {
  return MODE_MODELS[mode].ground ? distanceKm <= GROUND_MAX_KM : true;
}

// The modes we'll consider for a player: their ranked prefs (order = priority),
// or all modes if none are set. Flight is always appended as a fallback so long
// legs — where every ground mode is gated out — still resolve to something.
function candidateModes(prefs: TransportMode[]): TransportMode[] {
  const base = prefs.length ? prefs.filter((m) => ALL_TRANSPORT_MODES.includes(m)) : ALL_TRANSPORT_MODES;
  return base.includes(TransportMode.FLIGHT) ? base : [...base, TransportMode.FLIGHT];
}

function normalize(value: number, all: number[]): number {
  const min = Math.min(...all);
  const max = Math.max(...all);
  return max === min ? 0 : (value - min) / (max - min);
}

export interface LegAlternative extends ModeEstimate {
  // One-line trade-off vs. the recommended mode, e.g. "Train — $40 cheaper, +6h".
  rationale: string;
}

export interface LegRouting {
  distanceKm: number;
  recommended: ModeEstimate;
  alternatives: LegAlternative[];
  // True when the player's most-preferred feasible mode isn't the recommendation
  // and the gap is material — the UI expands the alternatives by default.
  contested: boolean;
}

function objective(e: ModeEstimate, priority: TransportPriority, durs: number[], costs: number[]): number {
  if (priority === "time") return e.durationMinutes;
  if (priority === "cost") return e.costEstimate;
  return normalize(e.durationMinutes, durs) + normalize(e.costEstimate, costs);
}

// Human-readable trade-off of an alternative relative to the recommendation.
function describeAlternative(rec: ModeEstimate, alt: ModeEstimate): string {
  const dCost = alt.costEstimate - rec.costEstimate; // + = pricier
  const dTime = alt.durationMinutes - rec.durationMinutes; // + = slower
  const costPart =
    dCost === 0
      ? "same price"
      : dCost < 0
        ? `${formatMoney(-dCost)} cheaper`
        : `${formatMoney(dCost)} more`;
  const timePart =
    dTime === 0
      ? "same time"
      : dTime < 0
        ? `${formatTravelTime(-dTime)} faster`
        : `+${formatTravelTime(dTime)}`;
  return `${formatTransportMode(alt.mode)} — ${costPart}, ${timePart}`;
}

// Materiality thresholds for flagging a leg "contested".
const CONTESTED_TIME_MIN = 60;
const CONTESTED_COST = 20;

// Route one leg: pick a recommended mode by Priority (preference breaks ties),
// list the feasible alternatives with rationales, and flag when the pick fights
// the player's preference. An `override` forces the recommended mode if it's
// feasible for this leg.
export function routeLeg(
  distanceKm: number,
  prefs: TransportMode[],
  priority: TransportPriority,
  override?: TransportMode | null,
): LegRouting {
  const feasible = candidateModes(prefs)
    .filter((m) => modeFeasible(distanceKm, m))
    .map((m) => estimateMode(distanceKm, m));
  // Flight is always feasible, so `feasible` is never empty; guard anyway.
  const options = feasible.length ? feasible : [estimateMode(distanceKm, TransportMode.FLIGHT)];

  const durs = options.map((o) => o.durationMinutes);
  const costs = options.map((o) => o.costEstimate);
  const prefIndex = (m: TransportMode) => {
    const i = prefs.indexOf(m);
    return i === -1 ? prefs.length + 1 : i;
  };

  const ranked = [...options].sort((a, b) => {
    const diff = objective(a, priority, durs, costs) - objective(b, priority, durs, costs);
    if (Math.abs(diff) > 1e-9) return diff;
    return prefIndex(a.mode) - prefIndex(b.mode); // preference breaks ties
  });

  // An explicit override wins as long as it's feasible for this leg, even if
  // it's outside the player's usual prefs (they deliberately picked it).
  const overridden = override && modeFeasible(distanceKm, override) ? estimateMode(distanceKm, override) : undefined;
  const recommended = overridden ?? ranked[0];

  const alternatives = ranked
    .filter((o) => o.mode !== recommended.mode)
    .map((o) => ({ ...o, rationale: describeAlternative(recommended, o) }));

  // Player's most-preferred feasible mode (prefs are ranked; index 0 = top).
  const topPref = prefs.find((m) => options.some((o) => o.mode === m));
  const topPrefEst = topPref ? options.find((o) => o.mode === topPref) : undefined;
  const contested =
    !override &&
    topPrefEst != null &&
    topPrefEst.mode !== recommended.mode &&
    (Math.abs(topPrefEst.durationMinutes - recommended.durationMinutes) >= CONTESTED_TIME_MIN ||
      Math.abs(topPrefEst.costEstimate - recommended.costEstimate) >= CONTESTED_COST);

  return { distanceKm, recommended, alternatives, contested };
}

// Priority derives from the schedule's travel weights, so there's one source of
// truth with the create form's rest/cost sliders. A heavier travel-TIME weight
// (protect body) favors the fastest mode; a heavier travel-COST weight favors
// the cheapest; equal weights are balanced.
export function transportPriorityFromWeights(
  weightTravelTime: number,
  weightTravelCost: number,
): TransportPriority {
  if (weightTravelTime > weightTravelCost + 1e-9) return "time";
  if (weightTravelCost > weightTravelTime + 1e-9) return "cost";
  return "balanced";
}

// Per-leg mode overrides on a schedule, keyed by the tournament pair a leg
// connects so they survive event edits and re-alignment.
export type LegModeOverrides = Record<string, TransportMode>;

export function legKey(fromId: string, toId: string): string {
  return `${fromId}>${toId}`;
}

// Narrows an untyped JSON blob (Prisma `Json`) to a clean override map, dropping
// any entry whose value isn't a real TransportMode.
export function parseLegModeOverrides(value: unknown): LegModeOverrides {
  if (!value || typeof value !== "object") return {};
  const out: LegModeOverrides = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && (ALL_TRANSPORT_MODES as string[]).includes(v)) {
      out[k] = v as TransportMode;
    }
  }
  return out;
}
