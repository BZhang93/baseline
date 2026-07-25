"use client";

import Link from "next/link";
import { useState } from "react";
import type { TournamentView } from "@/lib/tournaments";
import { formatDate, formatDateRange, formatMoney, formatSurface, formatTour } from "@/lib/format";
import { departureWindow } from "@/lib/departure";
import { lodgingSearchUrl } from "@/lib/booking-links";
import { GapBadge } from "../../_components/gap-badge";
import { ChangeBadge } from "../../_components/change-badge";

function EventCard({
  t,
  selected,
  onToggle,
}: {
  t: TournamentView;
  selected: boolean;
  onToggle: () => void;
}) {
  const dep = departureWindow(t.startDate, t.endDate, t.drawSize);
  return (
    <li className={`rounded-lg border p-4 ${selected ? "border-black" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1" />
          <div>
            <h3 className="font-medium">{t.name}</h3>
            <p className="text-sm text-gray-500">
              {t.city}, {t.country} · {formatDateRange(t.startDate, t.endDate)}
            </p>
            <p className="text-xs text-gray-400">
              Depart {formatDate(dep.earliest)}–{formatDate(dep.latest)} (draw {t.drawSize})
            </p>
          </div>
        </label>
        <GapBadge gap={t.gap} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{formatTour(t.tour)}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {t.tier.replaceAll("_", " ")}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {formatSurface(t.surface)}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">Draw {t.drawSize}</span>
        <ChangeBadge change={t.change} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <div className="text-gray-500">Winner</div>
          <div>{t.winnerPoints != null ? `${t.winnerPoints} pts` : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">Prize (Winner)</div>
          <div>{formatMoney(t.winnerPrize, t.currency ?? undefined)}</div>
        </div>
        <div>
          <div className="text-gray-500" title="Estimated — based on last year's field; no live entry lists yet">
            Est. Cutoff
          </div>
          <div>
            {t.liveCutoff.rank != null ? `~#${t.liveCutoff.rank}` : "—"}
            {t.liveCutoff.points != null ? ` · ${t.liveCutoff.points} pts` : ""}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <a
          href={lodgingSearchUrl(t.city, t.country, t.startDate)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Find stays ↗
        </a>
      </div>
    </li>
  );
}

export function BrowseResults({ tournaments }: { tournaments: TournamentView[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tournaments.length === 0) {
    return <p className="mt-8 text-gray-500">No tournaments match these filters.</p>;
  }

  // Selected ids in display (date) order for a sensible starting schedule.
  const selectedIds = tournaments.filter((t) => selected.has(t.id)).map((t) => t.id);

  return (
    <>
      <ul className="mt-4 grid gap-3 pb-20">
        {tournaments.map((t) => (
          <EventCard
            key={t.id}
            t={t}
            selected={selected.has(t.id)}
            onToggle={() => toggle(t.id)}
          />
        ))}
      </ul>

      {selected.size > 0 && (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white px-4 py-3">
          <span className="text-sm">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 underline"
          >
            Clear
          </button>
          {selected.size >= 2 && (
            <Link
              href={`/browse/compare?events=${selectedIds.join(",")}`}
              className="ml-auto rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Compare
            </Link>
          )}
          <Link
            href={`/schedules/new?events=${selectedIds.join(",")}`}
            className={`${selected.size >= 2 ? "" : "ml-auto"} rounded bg-black px-4 py-2 text-sm text-white`}
          >
            Create schedule from selection
          </Link>
        </div>
      )}
    </>
  );
}
