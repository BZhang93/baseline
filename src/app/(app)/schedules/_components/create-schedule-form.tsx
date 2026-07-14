"use client";

import { useMemo, useState, useTransition } from "react";
import type { PickerTournament } from "@/lib/schedules";
import { createScheduleAction } from "../actions";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDates(start: Date, end: Date): string {
  const s = `${MONTH[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${end.getUTCDate()}`
      : `${MONTH[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${s}–${e}`;
}

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

export function CreateScheduleForm({ tournaments }: { tournaments: PickerTournament[] }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [budgetCap, setBudgetCap] = useState("");
  const [maxEvents, setMaxEvents] = useState("");
  const [minRestDays, setMinRestDays] = useState("");
  const [priority, setPriority] = useState(50);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const available = useMemo(
    () => tournaments.filter((t) => !selectedIds.includes(t.id)),
    [tournaments, selectedIds],
  );

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
          Schedule name
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
            Budget cap
            <input
              inputMode="numeric"
              value={budgetCap}
              onChange={(e) => setBudgetCap(e.target.value)}
              placeholder="$"
              className={field}
            />
          </label>
          <label className={label}>
            Max events
            <input
              inputMode="numeric"
              value={maxEvents}
              onChange={(e) => setMaxEvents(e.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Min rest days
            <input
              inputMode="numeric"
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
              {priority >= 60 ? "Maximise points" : priority <= 40 ? "Protect body / cost" : "Balanced"}
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
            <span>Maximise points</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={isPending}
          className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create schedule"}
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
                  <span className="text-gray-500">· {fmtDates(t.startDate, t.endDate)}</span>
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

        <h2 className="mt-6 text-sm font-medium">Available events</h2>
        <ul className="mt-2 flex max-h-96 flex-col gap-2 overflow-auto pr-1">
          {available.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
            >
              <span>
                {t.name}{" "}
                <span className="text-gray-500">
                  · {t.city}, {t.country} · {fmtDates(t.startDate, t.endDate)} · {t.tour}
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
