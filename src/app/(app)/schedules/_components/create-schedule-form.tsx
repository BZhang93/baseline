"use client";

import { useMemo, useState, useTransition } from "react";
import type { PickerTournament } from "@/lib/schedules";
import { formatDateRange, formatSurface, formatTour } from "@/lib/format";
import {
  filterPickerTournaments,
  pickerOptions,
  EMPTY_PICKER_FILTERS,
  type PickerFilters,
} from "@/lib/picker-filter";
import { createScheduleAction } from "../actions";

// Priority slider (0 = protect body/cost, 100 = maximise points) → objective weights.
function weightsFromPriority(priority: number) {
  const p = priority / 100;
  return {
    weightPoints: 0.5 + 1.5 * p,
    weightMoney: 0.5 + 1.5 * p,
    weightTravelTime: 2 - 1.5 * p,
    weightTravelCost: 2 - 1.5 * p,
  };
}

function numberOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function CreateScheduleForm({
  tournaments,
  initialSelectedIds = [],
}: {
  tournaments: PickerTournament[];
  initialSelectedIds?: string[];
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
  const [isPending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(tournaments.map((t) => [t.id, t])), [tournaments]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [selectedIds, byId],
  );
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_PICKER_FILTERS);

  const options = useMemo(() => pickerOptions(tournaments), [tournaments]);
  const available = useMemo(
    () => tournaments.filter((t) => !selectedIds.includes(t.id)),
    [tournaments, selectedIds],
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={isPending}
          className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create Schedule"}
        </button>
      </div>

      {/* Right: event picker */}
      <div>
        <h2 className="text-sm font-medium">Selected ({selected.length})</h2>
        {selected.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">Add events from the list below.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {selected.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-gray-400">{i + 1}.</span> {t.name}{" "}
                  <span className="text-gray-500">· {formatDateRange(t.startDate, t.endDate)}</span>
                </span>
                <button
                  onClick={() => remove(t.id)}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
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
