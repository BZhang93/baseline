"use client";

import { useState, useTransition } from "react";
import type { TravelLegView } from "@/lib/schedules";
import { formatMoney, formatTravelTime, formatTransportMode } from "@/lib/format";
import { transportSearchUrl } from "@/lib/booking-links";
import type { TransportMode } from "@/generated/prisma/enums";
import { setLegModeAction } from "../actions";

const TRANSPORT_ICON: Record<TransportMode, string> = {
  FLIGHT: "✈",
  TRAIN: "🚆",
  BUS: "🚌",
  CAR: "🚗",
  RIDESHARE: "🚕",
};

const icon = (mode: TransportMode | null) => (mode ? TRANSPORT_ICON[mode] : "✈");

// One leg between two events: recommended mode inline, alternatives on demand.
// Choosing an alternative (or reverting an override) recomputes the schedule's
// travel + net totals server-side (player-feedback P1-7 / P1-7a).
export function LegModeControl({
  scheduleId,
  leg,
}: {
  scheduleId: string;
  leg: TravelLegView;
}) {
  // Auto-expand when the router recommends against the player's preferred mode.
  const [open, setOpen] = useState(leg.contested);
  const [isPending, startTransition] = useTransition();

  const choose = (mode: TransportMode | null) => {
    startTransition(async () => {
      await setLegModeAction(scheduleId, leg.afterTournamentId, leg.toTournamentId, mode);
    });
  };

  const modeLabel = leg.mode ? formatTransportMode(leg.mode) : "Flight";
  const hasAlternatives = leg.alternatives.length > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden>{icon(leg.mode)}</span>
        <span className="font-medium text-gray-700">
          {leg.fromLabel} → {leg.toLabel}
        </span>
        <span className="text-gray-400">·</span>
        <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
          {modeLabel}
        </span>
        <span className="text-gray-500">
          {formatTravelTime(leg.durationMinutes)} · {formatMoney(leg.costEstimate)}
        </span>
        {leg.overridden && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Your pick</span>
        )}
        {leg.contested && !leg.overridden && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
            Faster/cheaper than your usual
          </span>
        )}
        <a
          href={transportSearchUrl(leg.fromLabel, leg.toLabel, leg.mode)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-white"
        >
          Book {modeLabel.toLowerCase()} ↗
        </a>
      </div>

      {(hasAlternatives || leg.overridden) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-gray-500 underline hover:text-gray-800"
        >
          {open ? "Hide options" : `Other ways (${leg.alternatives.length})`}
        </button>
      )}

      {open && (hasAlternatives || leg.overridden) && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-gray-200 pt-2">
          {leg.alternatives.map((alt) => (
            <li key={alt.mode} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span aria-hidden>{icon(alt.mode)}</span>
              <span className="text-gray-600">
                {formatTravelTime(alt.durationMinutes)} · {formatMoney(alt.costEstimate)}
              </span>
              <span className="text-gray-400">— {alt.rationale}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => choose(alt.mode)}
                className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Use {formatTransportMode(alt.mode).toLowerCase()}
              </button>
            </li>
          ))}
          {leg.overridden && (
            <li>
              <button
                type="button"
                disabled={isPending}
                onClick={() => choose(null)}
                className="text-xs text-gray-500 underline hover:text-gray-800 disabled:opacity-50"
              >
                Revert to recommended
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
