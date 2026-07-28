"use client";

import { useMemo, useState, useTransition } from "react";
import type { PickerCandidate } from "@/lib/schedules";
import { formatDateRange, formatTierLabel, formatSurface } from "@/lib/format";
import { addEventAction } from "../actions";

// "Add event" affordance on the schedule detail (BRA-94): a collapsible picker
// of events in the schedule's window + circuit, each addable in place. The
// server appends + recomputes; the page revalidates.
export function AddEvents({
  scheduleId,
  candidates,
}: {
  scheduleId: string;
  candidates: PickerCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates
      .filter((c) => !needle || `${c.name} ${c.city} ${c.country}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [candidates, q]);

  if (candidates.length === 0) return null;

  const add = (id: string) =>
    startTransition(async () => {
      await addEventAction(scheduleId, id);
    });

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
      >
        {open ? "Close" : "+ Add event"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-gray-200 p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events in your window"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <ul className="mt-2 flex max-h-80 flex-col gap-1 overflow-auto pr-1">
            {filtered.length === 0 && (
              <li className="py-1 text-sm text-gray-500">No matching events to add.</li>
            )}
            {filtered.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm"
              >
                <span>
                  {c.name}{" "}
                  <span className="text-gray-500">
                    · {c.city}, {c.country} · {formatDateRange(c.startDate, c.endDate)} ·{" "}
                    {formatTierLabel(c.tier)} · {formatSurface(c.surface)}
                  </span>
                </span>
                <button
                  disabled={isPending}
                  onClick={() => add(c.id)}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
