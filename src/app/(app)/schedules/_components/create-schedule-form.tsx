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
  formatTravelTime,
  formatMoney,
  formatTransportMode,
} from "@/lib/format";
import { haversineKm, estimateTravel } from "@/lib/travel";
import { transportSearchUrl, lodgingSearchUrl } from "@/lib/booking-links";
import {
  filterPickerTournaments,
  pickerOptions,
  EMPTY_PICKER_FILTERS,
  type PickerFilters,
} from "@/lib/picker-filter";
import { createScheduleAction } from "../actions";

// Priority slider (0 = protect body/cost, 100 = maximize points) → objective
// weights. One source of truth for both the optimizer and the saved schedule.
function optimizerWeights(priority: number): OptimizerWeights {
  const p = priority / 100;
  return {
    points: 0.5 + 1.5 * p,
    money: 0.5 + 1.5 * p,
    travelTime: 2 - 1.5 * p,
    travelCost: 2 - 1.5 * p,
  };
}
function weightsFromPriority(priority: number) {
  const w = optimizerWeights(priority);
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

const ACCEPTANCE: Record<AcceptanceStatus, { label: string; className: string } | null> = {
  in: { label: "In", className: "bg-green-100 text-green-700" },
  borderline: { label: "Borderline", className: "bg-amber-100 text-amber-700" },
  out: { label: "Reach", className: "bg-gray-100 text-gray-600" },
  unknown: null,
};

export function CreateScheduleForm({
  candidates,
  initialSelectedIds = [],
  preferredTransport = null,
}: {
  candidates: PickerCandidate[];
  initialSelectedIds?: string[];
  preferredTransport?: TransportMode | null;
}) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [budgetCap, setBudgetCap] = useState("");
  const [maxEvents, setMaxEvents] = useState("");
  const [minRestDays, setMinRestDays] = useState("");
  const [priority, setPriority] = useState(50);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
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
  const totals = useMemo(() => scheduleTotals(selected), [selected]);

  // Estimated travel legs between consecutive selected events (for the trip
  // view + booking links). Mirrors the optimizer's leg estimate.
  const legs = useMemo(() => {
    const out: {
      from: PickerCandidate;
      to: PickerCandidate;
      minutes: number | null;
      cost: number | null;
    }[] = [];
    for (let i = 1; i < selected.length; i++) {
      const from = selected[i - 1];
      const to = selected[i];
      const hasCoords =
        from.lat != null && from.long != null && to.lat != null && to.long != null;
      const est = hasCoords
        ? estimateTravel(
            haversineKm(
              { lat: from.lat!, long: from.long! },
              { lat: to.lat!, long: to.long! },
            ),
          )
        : null;
      out.push({
        from,
        to,
        minutes: est?.durationMinutes ?? null,
        cost: est?.costEstimate ?? null,
      });
    }
    return out;
  }, [selected]);

  const [filters, setFilters] = useState<PickerFilters>(EMPTY_PICKER_FILTERS);

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
    setSelectedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }
  function remove(id: string) {
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  }

  // Run the optimizer over the events in the chosen window and adopt its pick.
  function suggest() {
    setError(null);
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    const inWindow = candidates.filter(
      (c) => (!fromD || c.endDate >= fromD) && (!toD || c.startDate <= toD),
    );
    const result = optimizeSchedule(inWindow, optimizerWeights(priority), {
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

  function submit() {
    setError(null);
    startTransition(async () => {
      const message = await createScheduleAction({
        name,
        startDate: from || undefined,
        endDate: to || undefined,
        budgetCap: numberOrUndefined(budgetCap),
        maxEvents: numberOrUndefined(maxEvents),
        minRestDays: numberOrUndefined(minRestDays),
        ...weightsFromPriority(priority),
        tournamentIds: selectedIds,
      });
      if (message) setError(message);
    });
  }

  const field = "rounded border border-gray-300 px-3 py-2 text-sm";
  const label = "flex flex-col gap-1 text-sm";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: settings */}
      <div className="flex flex-col gap-4">
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
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
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

        <div className={label}>
          <div className="flex justify-between">
            <span>Priority</span>
            <span className="text-gray-500">
              {priority >= 60 ? "Maximize points" : priority <= 40 ? "Protect body / cost" : "Balanced"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Protect body / cost</span>
            <span>Maximize points</span>
          </div>
        </div>

        <button
          onClick={suggest}
          className="w-fit rounded border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Suggest schedule
        </button>
        {suggestion && <p className="text-xs text-gray-500">{suggestion}</p>}

        {/* Live score summary for the current selection. */}
        <div className="grid grid-cols-2 gap-3 rounded border border-gray-200 p-3 text-sm sm:grid-cols-4">
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
            <div className="font-medium">{formatTravelTime(totals.travelTimeMin)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Travel cost</div>
            <div className="font-medium">{formatMoney(totals.travelCost)}</div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={isPending}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create Schedule"}
          </button>
          <Link
            href="/schedules"
            className="px-2 py-2 text-sm text-gray-500 hover:text-gray-800"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Right: event picker */}
      <div>
        <h2 className="text-sm font-medium">Selected ({selected.length})</h2>
        {selected.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">
            Add events below, or hit <span className="font-medium">Suggest schedule</span>.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {selected.map((t, i) => {
              const v = eventExpectedValue(t);
              const badge = ACCEPTANCE[t.acceptance];
              return (
                <li
                  key={t.id}
                  className="flex items-start justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                >
                  <div>
                    <div>
                      <span className="text-gray-400">{i + 1}.</span> {t.name}{" "}
                      <span className="text-gray-500">· {formatDateRange(t.startDate, t.endDate)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        ≈{v.expectedPoints} pts{v.resultLabel ? ` · reach ~${v.resultLabel}` : ""}
                      </span>
                      {badge && (
                        <span className={`rounded px-1.5 py-0.5 ${badge.className}`}>{badge.label}</span>
                      )}
                    </div>
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
                      onClick={() => remove(t.id)}
                      className="text-xs text-gray-500 hover:text-red-600"
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
          <div className="mt-4">
            <h3 className="text-xs font-medium text-gray-500">
              Getting around{" "}
              {preferredTransport ? `· ${formatTransportMode(preferredTransport)}` : ""}
            </h3>
            <ul className="mt-1 flex flex-col gap-1 text-xs text-gray-600">
              {legs.map((leg) => (
                <li key={`${leg.from.id}-${leg.to.id}`} className="flex items-center gap-2">
                  <span className="flex-1">
                    {leg.from.city} → {leg.to.city}
                    {leg.minutes != null && (
                      <span className="text-gray-400">
                        {" "}
                        · {formatTravelTime(leg.minutes)} · ~{formatMoney(leg.cost)}
                      </span>
                    )}
                  </span>
                  <a
                    href={transportSearchUrl(
                      `${leg.from.city}, ${leg.from.country}`,
                      `${leg.to.city}, ${leg.to.country}`,
                      preferredTransport,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-900"
                  >
                    Book ↗
                  </a>
                </li>
              ))}
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
          {filteredAvailable.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
            >
              <span>
                {t.name}{" "}
                <span className="text-gray-500">
                  · {t.city}, {t.country} · {formatDateRange(t.startDate, t.endDate)} · {formatTour(t.tour)}
                </span>
              </span>
              <button
                onClick={() => add(t.id)}
                className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
