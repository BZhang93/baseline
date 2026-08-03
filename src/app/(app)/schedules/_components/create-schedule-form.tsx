"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { PickerCandidate } from "@/lib/schedules";
import {
  optimizeSchedule,
  scheduleTotals,
  eventExpectedValue,
  type OptimizerWeights,
} from "@/lib/optimizer";
import type { AcceptanceStatus } from "@/lib/tournaments";
import type { TransportMode } from "@/generated/prisma/enums";
import {
  formatDateRange,
  formatSurface,
  formatTour,
  formatTierLabel,
  formatTravelTime,
  formatMoney,
  formatTransportMode,
} from "@/lib/format";
import { haversineKm } from "@/lib/travel";
import { routeLeg, transportPriorityFromWeights, type LegRouting } from "@/lib/transport";
import { resolvePlayedPath, conflictsWith } from "@/lib/schedule-path";
import { transportSearchUrl, lodgingSearchUrl } from "@/lib/booking-links";
import {
  filterPickerTournaments,
  pickerOptions,
  EMPTY_PICKER_FILTERS,
  type PickerFilters,
} from "@/lib/picker-filter";
import {
  createScheduleAction,
  updateScheduleAction,
  planFromTextAction,
  explainPlanAction,
} from "../actions";
import type { PlanIntent } from "@/lib/ai/plan-intent";
import type { PickFact } from "@/lib/ai/rationale";

// Two independent priorities (0 = don't care … 100 = top priority):
//   restPriority → how much to penalize travel TIME (protect the body / rest)
//   costPriority → how much to penalize travel COST (save money)
// Points/prize sit at a fixed baseline; raising a priority makes the optimizer
// trade some points away to cut that kind of travel. One source of truth for
// both the optimizer preview and the saved schedule's weights.
function optimizerWeights(restPriority: number, costPriority: number): OptimizerWeights {
  return {
    points: 1,
    money: 1,
    travelTime: 0.5 + (restPriority / 100) * 3,
    travelCost: 0.5 + (costPriority / 100) * 3,
  };
}
function scheduleWeights(restPriority: number, costPriority: number) {
  const w = optimizerWeights(restPriority, costPriority);
  return {
    weightPoints: w.points,
    weightMoney: w.money,
    weightTravelTime: w.travelTime,
    weightTravelCost: w.travelCost,
  };
}

function numberOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// New schedules default their window to the end of the current year, so it
// covers the rest of the season out of the box (mirrors Browse).
const DEFAULT_TO = `${new Date().getUTCFullYear()}-12-31`;

const ACCEPTANCE: Record<AcceptanceStatus, { label: string; className: string } | null> = {
  in: { label: "In", className: "bg-green-100 text-green-700" },
  borderline: { label: "Borderline", className: "bg-amber-100 text-amber-700" },
  out: { label: "Reach", className: "bg-gray-100 text-gray-600" },
  unknown: null,
};

export interface ScheduleFormInitial {
  name?: string;
  from?: string;
  to?: string;
  budgetCap?: string;
  maxEvents?: string;
  minRestDays?: string;
  tripCosts?: string;
  restPriority?: number;
  costPriority?: number;
}

const TRANSPORT_ICON: Record<TransportMode, string> = {
  FLIGHT: "✈",
  TRAIN: "🚆",
  BUS: "🚌",
  CAR: "🚗",
  RIDESHARE: "🚕",
};

export function CreateScheduleForm({
  candidates,
  initialSelectedIds = [],
  transportModes = [],
  scheduleId,
  initial,
}: {
  candidates: PickerCandidate[];
  initialSelectedIds?: string[];
  // Player's ranked transport preferences — drive the per-leg mode router.
  transportModes?: TransportMode[];
  // When set, the form edits this schedule (saves back) instead of creating.
  scheduleId?: string;
  initial?: ScheduleFormInitial;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? DEFAULT_TO);
  const [budgetCap, setBudgetCap] = useState(initial?.budgetCap ?? "");
  const [maxEvents, setMaxEvents] = useState(initial?.maxEvents ?? "");
  const [minRestDays, setMinRestDays] = useState(initial?.minRestDays ?? "");
  const [tripCosts, setTripCosts] = useState(initial?.tripCosts ?? "");
  const [restPriority, setRestPriority] = useState(initial?.restPriority ?? 50);
  const [costPriority, setCostPriority] = useState(initial?.costPriority ?? 50);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAiTransition] = useTransition();
  const [aiRationale, setAiRationale] = useState<Record<string, string>>({});
  const [rationalePending, startRationaleTransition] = useTransition();
  const [isPending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(candidates.map((t) => [t.id, t])), [candidates]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [selectedIds, byId],
  );
  // A player plays one event per week: resolve the non-overlapping played path
  // so totals + legs never sum simultaneous events (player-feedback P0-1).
  const { path, conflicts } = useMemo(() => resolvePlayedPath(selected), [selected]);
  const conflictIds = useMemo(() => new Set(conflicts.map((t) => t.id)), [conflicts]);
  const totals = useMemo(() => scheduleTotals(path), [path]);

  // Rest vs cost priority steers mode choice the same way it sets the saved
  // schedule's weights, so the preview matches what the server will route.
  const routePriority = useMemo(() => {
    const w = optimizerWeights(restPriority, costPriority);
    return transportPriorityFromWeights(w.travelTime, w.travelCost);
  }, [restPriority, costPriority]);

  // Multi-modal per-leg routing over the played path (player-feedback P1-7): a
  // recommended mode + alternatives per hop, mirroring buildLegsAndScores.
  const legs = useMemo(() => {
    const out: { from: PickerCandidate; to: PickerCandidate; routing: LegRouting | null }[] = [];
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      const hasCoords =
        from.lat != null && from.long != null && to.lat != null && to.long != null;
      const routing = hasCoords
        ? routeLeg(
            haversineKm(
              { lat: from.lat!, long: from.long! },
              { lat: to.lat!, long: to.long! },
            ),
            transportModes,
            routePriority,
          )
        : null;
      out.push({ from, to, routing });
    }
    return out;
  }, [path, transportModes, routePriority]);

  // Travel time/cost from the routed modes (not flight-only), so the live
  // summary matches the saved schedule's totals.
  const routedTravel = useMemo(() => {
    let minutes = 0;
    let cost = 0;
    for (const l of legs) {
      if (l.routing) {
        minutes += l.routing.recommended.durationMinutes;
        cost += l.routing.recommended.costEstimate;
      }
    }
    return { minutes, cost };
  }, [legs]);

  // The picker's date range tracks the schedule window, so the events on the
  // right end where the "To" date does.
  const [filters, setFilters] = useState<PickerFilters>({
    ...EMPTY_PICKER_FILTERS,
    to: initial?.to ?? DEFAULT_TO,
  });

  // Keep the schedule "To" and the picker's "to" filter in sync.
  function handleToChange(value: string) {
    setTo(value);
    setFilters((f) => ({ ...f, to: value }));
  }

  const options = useMemo(() => pickerOptions(candidates), [candidates]);
  const available = useMemo(
    () => candidates.filter((t) => !selectedIds.includes(t.id)),
    [candidates, selectedIds],
  );
  const filteredAvailable = useMemo(
    () => filterPickerTournaments(available, filters),
    [available, filters],
  );

  function setFilter(key: keyof PickerFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function add(id: string) {
    const candidate = byId.get(id);
    // One event per week: block only against the played path (events actually
    // kept), so an event that overlaps an already-dropped conflict is still
    // addable when it fits the real path.
    if (candidate && conflictsWith(candidate, path)) {
      setSuggestion(`${candidate.name} is the same week as an event you've already added.`);
      return;
    }
    setSelectedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }
  function remove(id: string) {
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  }

  // Run the optimizer over the events in the chosen window and adopt its pick.
  function suggest() {
    setError(null);
    setAiRationale({});
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    const inWindow = candidates.filter(
      (c) => (!fromD || c.endDate >= fromD) && (!toD || c.startDate <= toD),
    );
    const result = optimizeSchedule(inWindow, optimizerWeights(restPriority, costPriority), {
      maxEvents: numberOrUndefined(maxEvents),
      minRestDays: numberOrUndefined(minRestDays),
      budgetCap: numberOrUndefined(budgetCap),
    });
    if (result.events.length === 0) {
      setSuggestion("No feasible events in that window and budget.");
      return;
    }
    setSelectedIds(result.events.map((e) => e.id));
    setSuggestion(
      `Suggested ${result.events.length} event${
        result.events.length > 1 ? "s" : ""
      } — edit below and the totals update live.`,
    );
  }

  // Apply an AI-parsed PlanIntent: set the visible optimizer knobs, then run the
  // deterministic optimizer with the intent's values directly (the setState
  // calls above are async, so we can't read them back here). The LLM never picks
  // events — optimizeSchedule does, over the intent's window/weights/constraints.
  function applyIntent(intent: PlanIntent) {
    setAiRationale({});
    if (intent.restPriority != null) setRestPriority(intent.restPriority);
    if (intent.costPriority != null) setCostPriority(intent.costPriority);
    if (intent.from) setFrom(intent.from);
    if (intent.to) handleToChange(intent.to);
    if (intent.budgetCap != null) setBudgetCap(String(intent.budgetCap));
    if (intent.maxEvents != null) setMaxEvents(String(intent.maxEvents));
    if (intent.minRestDays != null) setMinRestDays(String(intent.minRestDays));

    const rest = intent.restPriority ?? restPriority;
    const cost = intent.costPriority ?? costPriority;
    const fromD = intent.from ? new Date(intent.from) : from ? new Date(from) : null;
    const toD = intent.to ? new Date(intent.to) : to ? new Date(to) : null;
    const inWindow = candidates.filter(
      (c) =>
        (!fromD || c.endDate >= fromD) &&
        (!toD || c.startDate <= toD) &&
        (!intent.surfaces || intent.surfaces.includes(c.surface)),
    );
    const result = optimizeSchedule(inWindow, optimizerWeights(rest, cost), {
      maxEvents: intent.maxEvents ?? numberOrUndefined(maxEvents),
      minRestDays: intent.minRestDays ?? numberOrUndefined(minRestDays),
      budgetCap: intent.budgetCap ?? numberOrUndefined(budgetCap),
    });

    const noted = [
      intent.surfaces?.map((s) => s.toLowerCase()).join("/"),
      intent.regions?.join("/"),
      intent.note,
    ]
      .filter(Boolean)
      .join("; ");
    const notedSuffix = noted ? ` Also noted: ${noted}.` : "";
    if (result.events.length === 0) {
      setSuggestion(`Set your preferences, but no feasible events fit that window and budget.${notedSuffix}`);
      return;
    }
    setSelectedIds(result.events.map((e) => e.id));
    setSuggestion(
      `AI plan: ${result.events.length} event${result.events.length > 1 ? "s" : ""} — edit below; totals update live.${notedSuffix}`,
    );
    generateRationale(result.events, intent, rest, cost);
  }

  // Grounded per-event "why" for the AI plan (BRA-47): the optimizer's real
  // numbers are sent to the LLM, which explains each pick without inventing
  // figures. Rendered under each selected event when it arrives.
  function generateRationale(
    events: { id: string }[],
    intent: PlanIntent,
    rest: number,
    cost: number,
  ) {
    const picks: PickFact[] = [];
    for (const e of events) {
      const c = byId.get(e.id);
      if (!c) continue;
      const v = eventExpectedValue(c);
      picks.push({
        id: c.id,
        name: c.name,
        city: c.city,
        country: c.country,
        surface: c.surface,
        expectedPoints: v.expectedPoints,
        expectedPrize: v.expectedPrize,
        reach: c.acceptance,
      });
    }
    if (picks.length === 0) return;
    const priorities = `rest priority ${rest}/100, cost priority ${cost}/100`;
    startRationaleTransition(async () => {
      const res = await explainPlanAction(picks, { priorities, note: intent.note });
      if (res.rationales) {
        const map: Record<string, string> = {};
        picks.forEach((p, i) => {
          const why = res.rationales![i];
          if (why) map[p.id] = why;
        });
        setAiRationale(map);
      }
    });
  }

  function planWithAi() {
    setAiError(null);
    const text = aiText;
    startAiTransition(async () => {
      const res = await planFromTextAction(text);
      if (res.error) setAiError(res.error);
      else if (res.intent) applyIntent(res.intent);
    });
  }

  function submit() {
    setError(null);
    const input = {
      name,
      startDate: from || undefined,
      endDate: to || undefined,
      budgetCap: numberOrUndefined(budgetCap),
      maxEvents: numberOrUndefined(maxEvents),
      minRestDays: numberOrUndefined(minRestDays),
      tripCosts: numberOrUndefined(tripCosts),
      ...scheduleWeights(restPriority, costPriority),
      tournamentIds: selectedIds,
    };
    startTransition(async () => {
      const message = scheduleId
        ? await updateScheduleAction(scheduleId, input)
        : await createScheduleAction(input);
      if (message) setError(message);
    });
  }

  const field = "rounded border border-gray-300 px-3 py-2 text-sm";
  const label = "flex flex-col gap-1 text-sm";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: settings */}
      <div className="flex flex-col gap-4">
        {/* AI natural-language front door (BRA-47): fills the optimizer knobs,
            then the deterministic optimizer drafts a feasible plan. */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Plan with AI</span>
            <span className="text-xs text-gray-500">
              Describe your ideal swing in plain words. It sets your window, priorities, and budget,
              then drafts a feasible plan you can edit.
            </span>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              rows={2}
              placeholder="e.g. European clay in Aug–Sep, protect my body, travel under €6k, max 4 events"
              className={`${field} resize-none`}
            />
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={planWithAi}
              disabled={aiPending || !aiText.trim()}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {aiPending ? "Planning…" : "Plan with AI"}
            </button>
            {aiError && <span className="text-xs text-red-600">{aiError}</span>}
            {rationalePending && <span className="text-xs text-gray-400">explaining picks…</span>}
          </div>
        </div>

        <label className={label}>
          Schedule Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. European clay swing"
            className={field}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
          </label>
          <label className={label}>
            To
            <input type="date" value={to} onChange={(e) => handleToChange(e.target.value)} className={field} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className={label}>
            Budget Cap
            <input
              type="number"
              min={0}
              value={budgetCap}
              onChange={(e) => setBudgetCap(e.target.value)}
              placeholder="$"
              className={field}
            />
          </label>
          <label className={label}>
            Max Events
            <input
              type="number"
              min={0}
              value={maxEvents}
              onChange={(e) => setMaxEvents(e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Min Rest Days
            <input
              type="number"
              min={0}
              value={minRestDays}
              onChange={(e) => setMinRestDays(e.target.value)}
              className={field}
            />
          </label>
        </div>

        <p className="-mt-2 text-xs text-gray-400">
          <span className="font-medium text-gray-500">Budget Cap</span> is a ceiling —
          &ldquo;Suggest&rdquo; won&apos;t propose a swing whose estimated travel cost exceeds it.
        </p>

        <label className={label}>
          Trip Costs (lodging, food, etc.)
          <input
            type="number"
            min={0}
            value={tripCosts}
            onChange={(e) => setTripCosts(e.target.value)}
            placeholder="$ out-of-pocket for the swing"
            className={field}
          />
          <span className="text-xs text-gray-400">
            Your actual out-of-pocket (not a limit) — subtracted with estimated travel from
            expected prize for net earnings.
          </span>
        </label>

        <div className="flex flex-col gap-3">
          <span className="text-sm">Priorities</span>
          <div className={label}>
            <div className="flex justify-between text-xs">
              <span>Protect body (rest / less travel)</span>
              <span className="text-gray-500">{restPriority}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={restPriority}
              onChange={(e) => setRestPriority(Number(e.target.value))}
            />
          </div>
          <div className={label}>
            <div className="flex justify-between text-xs">
              <span>Save on cost (cheaper travel)</span>
              <span className="text-gray-500">{costPriority}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={costPriority}
              onChange={(e) => setCostPriority(Number(e.target.value))}
            />
          </div>
          <span className="text-xs text-gray-400">
            Higher = the optimizer trades more points to cut travel time / cost. Set both low to
            chase points.
          </span>
        </div>

        {/* Live score summary for the current selection. */}
        <div className="grid grid-cols-2 gap-3 rounded border border-gray-200 p-3 text-sm sm:grid-cols-5">
          <div>
            <div className="text-xs text-gray-500">Exp. points</div>
            <div className="font-medium">{totals.expectedPoints}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Exp. prize</div>
            <div className="font-medium">{formatMoney(totals.expectedPrize)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Travel time</div>
            <div className="font-medium">{formatTravelTime(routedTravel.minutes)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Travel cost</div>
            <div className="font-medium">{formatMoney(routedTravel.cost)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Net after costs</div>
            <div
              className={`font-medium ${
                totals.expectedPrize - routedTravel.cost - (numberOrUndefined(tripCosts) ?? 0) < 0
                  ? "text-red-600"
                  : "text-green-700"
              }`}
            >
              {formatMoney(
                totals.expectedPrize - routedTravel.cost - (numberOrUndefined(tripCosts) ?? 0),
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={isPending}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isPending
              ? scheduleId
                ? "Saving…"
                : "Creating…"
              : scheduleId
                ? "Save Changes"
                : "Create Schedule"}
          </button>
          <Link
            href={scheduleId ? `/schedules/${scheduleId}` : "/schedules"}
            className="px-2 py-2 text-sm text-gray-500 hover:text-gray-800"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Right: event picker */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Selected ({selected.length})</h2>
          <button
            onClick={suggest}
            className="rounded border border-black px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            Suggest schedule
          </button>
        </div>
        {suggestion && <p className="mt-1 text-xs text-gray-500">{suggestion}</p>}
        {selected.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">
            Add events below, or hit <span className="font-medium">Suggest schedule</span>.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {selected.map((t, i) => {
              const v = eventExpectedValue(t);
              const badge = ACCEPTANCE[t.acceptance];
              const isConflict = conflictIds.has(t.id);
              return (
                <li
                  key={t.id}
                  className={`flex items-start justify-between rounded border px-3 py-2 text-sm ${
                    isConflict ? "border-red-200 bg-red-50" : "border-gray-200"
                  }`}
                >
                  <div>
                    <div>
                      <span className="text-gray-400">{i + 1}.</span> {t.name}{" "}
                      <span className="text-gray-500">· {formatDateRange(t.startDate, t.endDate)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      {isConflict ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">
                          Same-week conflict · not counted
                        </span>
                      ) : (
                        <>
                          <span>
                            ≈{v.expectedPoints} pts{v.resultLabel ? ` · reach ~${v.resultLabel}` : ""}
                          </span>
                          {badge && (
                            <span className={`rounded px-1.5 py-0.5 ${badge.className}`}>{badge.label}</span>
                          )}
                        </>
                      )}
                    </div>
                    {aiRationale[t.id] && (
                      <div className="mt-1 text-xs italic text-gray-500">{aiRationale[t.id]}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <a
                      href={lodgingSearchUrl(t.city, t.country, t.startDate)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 underline hover:text-gray-800"
                    >
                      Find stays ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="inline-flex min-h-[44px] items-center text-xs text-gray-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {legs.length > 0 && (
          <div className="mt-4 rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-medium text-gray-700">Getting around</h3>
            <p className="text-xs text-gray-400">
              Recommended mode per hop — picked by your priorities &amp; transport prefs. You can
              change any leg after saving.
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-xs">
              {legs.map((leg) => {
                const rec = leg.routing?.recommended ?? null;
                const mode = rec?.mode ?? null;
                return (
                  <li key={`${leg.from.id}-${leg.to.id}`} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span aria-hidden>{mode ? TRANSPORT_ICON[mode] : "✈"}</span>
                      <span className="flex-1 text-gray-700">
                        {leg.from.city} → {leg.to.city}
                        {rec && (
                          <span className="text-gray-400">
                            {" "}
                            · {mode ? formatTransportMode(mode) : "Flight"} ·{" "}
                            {formatTravelTime(rec.durationMinutes)} · ~{formatMoney(rec.costEstimate)}
                          </span>
                        )}
                      </span>
                      <a
                        href={transportSearchUrl(
                          `${leg.from.city}, ${leg.from.country}`,
                          `${leg.to.city}, ${leg.to.country}`,
                          mode,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-gray-900"
                      >
                        Book ↗
                      </a>
                    </div>
                    {leg.routing && leg.routing.alternatives.length > 0 && (
                      <span className="pl-6 text-gray-400">
                        or {leg.routing.alternatives[0].rationale}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-sm font-medium">Available Events</h2>
          <span className="text-xs text-gray-400">{filteredAvailable.length} shown</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search"
            className="min-w-32 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <select
            value={filters.tour}
            onChange={(e) => setFilter("tour", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All tours</option>
            {options.tours.map((v) => (
              <option key={v} value={v}>
                {formatTour(v)}
              </option>
            ))}
          </select>
          <select
            value={filters.surface}
            onChange={(e) => setFilter("surface", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All surfaces</option>
            {options.surfaces.map((v) => (
              <option key={v} value={v}>
                {formatSurface(v)}
              </option>
            ))}
          </select>
          <select
            value={filters.country}
            onChange={(e) => setFilter("country", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All regions</option>
            {options.countries.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          {(filters.q ||
            filters.tour ||
            filters.surface ||
            filters.country ||
            filters.from ||
            filters.to) && (
            <button
              onClick={() => setFilters(EMPTY_PICKER_FILTERS)}
              className="px-2 py-1 text-sm text-gray-500 underline"
            >
              Clear
            </button>
          )}
        </div>

        <ul className="mt-2 flex max-h-96 flex-col gap-2 overflow-auto pr-1">
          {filteredAvailable.length === 0 && (
            <li className="text-sm text-gray-500">No events match these filters.</li>
          )}
          {filteredAvailable.map((t) => {
            const collides = conflictsWith(t, path);
            const v = eventExpectedValue(t);
            const badge = ACCEPTANCE[t.acceptance];
            return (
              <li
                key={t.id}
                className="flex items-start justify-between gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
              >
                <div>
                  <div>
                    {t.name}{" "}
                    <span className="text-gray-500">
                      · {formatDateRange(t.startDate, t.endDate)} · {formatTierLabel(t.tier)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span>
                      {t.city}, {t.country} · {formatSurface(t.surface)}
                    </span>
                    <span>
                      ≈{v.expectedPoints} pts · {formatMoney(v.expectedPrize)}
                    </span>
                    {badge && (
                      <span className={`rounded px-1.5 py-0.5 ${badge.className}`}>{badge.label}</span>
                    )}
                  </div>
                </div>
                {collides ? (
                  <span className="whitespace-nowrap text-xs text-gray-400" title="Same week as a selected event">
                    Same week
                  </span>
                ) : (
                  <button
                    onClick={() => add(t.id)}
                    className="whitespace-nowrap rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
