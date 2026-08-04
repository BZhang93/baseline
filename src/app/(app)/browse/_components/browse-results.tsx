"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TournamentView } from "@/lib/tournaments";
import type { AcceptanceStatus } from "@/lib/tournaments";
import { formatDate, formatDateRange, formatMoney, formatSurface, formatTierLabel } from "@/lib/format";
import { departureWindow } from "@/lib/departure";
import { lodgingSearchUrl, officialSiteUrl } from "@/lib/booking-links";
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
            {t.forecast.expectedResult && (
              <p className="text-xs text-gray-400" title="Estimated from your ranking vs the field; sharpens with results/draw data">
                Likely {t.forecast.expectedResult}
                {t.forecast.deepRunProb > 0
                  ? ` · ${Math.round(t.forecast.deepRunProb * 100)}% to reach SF+`
                  : ""}
              </p>
            )}
          </div>
        </label>
        <GapBadge gap={t.gap} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {formatTierLabel(t.tier)}
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

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={officialSiteUrl(t.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Official site ↗
        </a>
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

const STATUS_RANK: Record<AcceptanceStatus, number> = { in: 0, borderline: 1, unknown: 2, out: 3 };

export function BrowseResults({ tournaments }: { tournaments: TournamentView[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"date" | "points" | "gap">("date");
  const [hideOut, setHideOut] = useState(false);

  // Sort/hide are client-side — every event is already loaded (BRA-90).
  const displayed = useMemo(() => {
    const list = hideOut ? tournaments.filter((t) => t.gap.status !== "out") : tournaments;
    return [...list].sort((a, b) => {
      if (sortBy === "points") return (b.winnerPoints ?? 0) - (a.winnerPoints ?? 0);
      if (sortBy === "gap") {
        const d = STATUS_RANK[a.gap.status] - STATUS_RANK[b.gap.status];
        return d !== 0 ? d : (a.gap.spots ?? Infinity) - (b.gap.spots ?? Infinity);
      }
      return a.startDate.getTime() - b.startDate.getTime();
    });
  }, [tournaments, sortBy, hideOut]);

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
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1 text-gray-600">
          Sort
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="date">Date</option>
            <option value="points">Points</option>
            <option value="gap">Reachability</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-gray-600">
          <input type="checkbox" checked={hideOut} onChange={(e) => setHideOut(e.target.checked)} />
          Hide events past my cutoff
        </label>
        <span className="text-gray-400">{displayed.length} shown</span>
      </div>

      {displayed.length === 0 ? (
        <p className="mt-8 text-gray-500">
          Every event is past your cutoff.{" "}
          <button onClick={() => setHideOut(false)} className="underline">
            Show all
          </button>
          .
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 pb-20 lg:grid-cols-2">
          {displayed.map((t) => (
            <EventCard
              key={t.id}
              t={t}
              selected={selected.has(t.id)}
              onToggle={() => toggle(t.id)}
            />
          ))}
        </ul>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-12 -mx-4 flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:bottom-0">
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
