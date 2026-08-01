import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { getCompareData, type CompareTournament } from "@/lib/tournaments";
import {
  formatDateRange,
  formatMoney,
  formatSurface,
  formatTierLabel,
  formatTravelTime,
} from "@/lib/format";
import { GapBadge } from "../../_components/gap-badge";
import { ChangeBadge } from "../../_components/change-badge";

function Row({
  label,
  events,
  render,
}: {
  label: string;
  events: CompareTournament[];
  render: (e: CompareTournament) => ReactNode;
}) {
  return (
    <tr className="border-t border-gray-100">
      <th
        scope="row"
        className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-left font-medium text-gray-500"
      >
        {label}
      </th>
      {events.map((e) => (
        <td key={e.id} className="p-2 align-top">
          {render(e)}
        </td>
      ))}
    </tr>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const raw = Array.isArray(sp.events) ? sp.events[0] : sp.events;
  const ids = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const events = await getCompareData(ids, session.player);

  return (
    <div>
      <Link href="/browse" className="text-sm text-gray-500 underline">
        ← Browse
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Compare Events</h1>

      {events.length < 2 ? (
        <p className="mt-4 text-gray-500">
          Select at least two events in Browse, then hit Compare.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 p-2" />
                {events.map((e) => (
                  <th key={e.id} className="min-w-44 bg-gray-50 p-2 text-left align-top">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold">{e.name}</span>
                      <ChangeBadge change={e.change} />
                    </div>
                    <div className="text-xs font-normal text-gray-500">
                      {e.city}, {e.country}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Dates" events={events} render={(e) => formatDateRange(e.startDate, e.endDate)} />
              <Row
                label="Tour / Tier"
                events={events}
                render={(e) => formatTierLabel(e.tier)}
              />
              <Row label="Surface" events={events} render={(e) => formatSurface(e.surface)} />
              <Row label="Draw" events={events} render={(e) => `${e.drawSize}`} />
              <Row
                label="Winner points"
                events={events}
                render={(e) => (e.winnerPoints != null ? `${e.winnerPoints} pts` : "—")}
              />
              <Row
                label="Winner prize"
                events={events}
                render={(e) => formatMoney(e.winnerPrize, e.currency ?? undefined)}
              />
              <Row
                label="Est. cutoff"
                events={events}
                render={(e) => (e.liveCutoff.rank != null ? `~#${e.liveCutoff.rank}` : "—")}
              />
              <Row label="Your gap" events={events} render={(e) => <GapBadge gap={e.gap} />} />
              <Row
                label="Travel from home"
                events={events}
                render={(e) =>
                  e.travelFromHome
                    ? `${formatTravelTime(e.travelFromHome.minutes)} · ${formatMoney(e.travelFromHome.cost)}`
                    : "—"
                }
              />
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Cutoffs are estimates; travel is an estimate from your home base.
      </p>
    </div>
  );
}
