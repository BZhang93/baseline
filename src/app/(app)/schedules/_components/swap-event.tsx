"use client";

import { useState, useTransition } from "react";
import type { PickerCandidate } from "@/lib/schedules";
import { eventExpectedValue } from "@/lib/optimizer";
import type { AcceptanceStatus } from "@/lib/tournaments";
import { formatMoney, formatTour, formatSurface } from "@/lib/format";
import { swapEventAction } from "../actions";

const ACCEPTANCE: Record<AcceptanceStatus, { label: string; className: string } | null> = {
  in: { label: "In", className: "bg-green-100 text-green-700" },
  borderline: { label: "Borderline", className: "bg-amber-100 text-amber-700" },
  out: { label: "Reach", className: "bg-gray-100 text-gray-600" },
  unknown: null,
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const deltaClass = (n: number) => (n > 0 ? "text-green-700" : n < 0 ? "text-red-600" : "text-gray-400");

// Per-week swap (BRA-95): replace this week's event with another that week,
// showing the expected points/prize deltas + reachability so the pick is informed.
export function SwapEvent({
  scheduleId,
  current,
  alternatives,
}: {
  scheduleId: string;
  current: PickerCandidate;
  alternatives: PickerCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (alternatives.length === 0) return null;
  const cur = eventExpectedValue(current);

  const swap = (addId: string) =>
    startTransition(async () => {
      await swapEventAction(scheduleId, current.id, addId);
    });

  return (
    <div className="pl-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-500 underline hover:text-gray-800"
      >
        {open ? "Hide this week's alternatives" : `Swap this week (${alternatives.length})`}
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 border-l border-gray-200 pl-3">
          {alternatives.map((a) => {
            const v = eventExpectedValue(a);
            const dPts = v.expectedPoints - cur.expectedPoints;
            const dPrize = v.expectedPrize - cur.expectedPrize;
            const badge = ACCEPTANCE[a.acceptance];
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="font-medium text-gray-700">{a.name}</span>
                <span className="text-gray-400">
                  {formatTour(a.tour)} · {formatSurface(a.surface)}
                </span>
                <span className="text-gray-600">
                  ≈{v.expectedPoints} pts <span className={deltaClass(dPts)}>({signed(dPts)})</span> ·{" "}
                  {formatMoney(v.expectedPrize)}{" "}
                  <span className={deltaClass(dPrize)}>({signed(dPrize)})</span>
                </span>
                {badge && (
                  <span className={`rounded px-1.5 py-0.5 ${badge.className}`}>{badge.label}</span>
                )}
                <button
                  disabled={isPending}
                  onClick={() => swap(a.id)}
                  className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Swap in
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
