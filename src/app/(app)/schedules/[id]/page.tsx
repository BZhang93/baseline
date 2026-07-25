import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { getScheduleDetail, getScheduleCandidates, type ScheduleEventView } from "@/lib/schedules";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  formatSurface,
  formatTour,
  formatTravelTime,
} from "@/lib/format";
import { lodgingSearchUrl } from "@/lib/booking-links";
import { GapBadge } from "../../_components/gap-badge";
import { ChangeBadge } from "../../_components/change-badge";
import { RenameName } from "../_components/rename-name";
import { TripCosts } from "../_components/trip-costs";
import { LegModeControl } from "../_components/leg-mode-control";
import { AddEvents } from "../_components/add-events";
import { SwapEvent } from "../_components/swap-event";
import { eventsOverlap } from "@/lib/schedule-path";
import { removeEventAction, deleteScheduleAction } from "../actions";

const externalLink =
  "rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50";

function EventRow({
  scheduleId,
  e,
}: {
  scheduleId: string;
  e: ScheduleEventView;
}) {
  return (
    <div className={`rounded-lg border p-4 ${e.conflict || e.circuitMismatch ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{e.name}</h3>
          <p className="text-sm text-gray-500">
            {e.city}, {e.country} · {formatDateRange(e.startDate, e.endDate)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Depart {formatDate(e.departure.earliest)} (1st-round loss) –{" "}
            {formatDate(e.departure.latest)} (win · {e.departure.rounds} rounds)
          </p>
          {e.qualiArrival && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Qualifying from {formatDate(e.arrivalDate)} — arrive before main draw
            </p>
          )}
          {e.conflict && (
            <p className="mt-1 text-xs font-medium text-red-700">
              Same-week conflict — not counted in totals
            </p>
          )}
          {e.circuitMismatch && (
            <p className="mt-1 text-xs font-medium text-red-700">
              Not in your circuit — this event shouldn&apos;t be here; remove it.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <GapBadge gap={e.cutoff.gap} />
          <form action={removeEventAction.bind(null, scheduleId, e.tournamentId)}>
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{formatTour(e.tour)}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {e.tier.replaceAll("_", " ")}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {formatSurface(e.surface)}
        </span>
        <ChangeBadge change={e.change} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <div className="text-gray-500">Winner</div>
          <div>{e.winnerPoints != null ? `${e.winnerPoints} pts` : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">Prize (Winner)</div>
          <div>{formatMoney(e.winnerPrize, e.currency ?? undefined)}</div>
        </div>
        <div>
          <div className="text-gray-500" title="Estimated — based on last year's field; no live entry lists yet">
            Est. Cutoff
          </div>
          <div>
            {e.cutoff.liveCutoff.rank != null ? `~#${e.cutoff.liveCutoff.rank}` : "—"}
            {e.cutoff.liveCutoff.points != null ? ` · ${e.cutoff.liveCutoff.points} pts` : ""}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <a
          href={lodgingSearchUrl(e.city, e.country, e.arrivalDate)}
          target="_blank"
          rel="noopener noreferrer"
          className={externalLink}
        >
          Find stays ↗
        </a>
      </div>
    </div>
  );
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const schedule = await getScheduleDetail(session.player.id, id, session.player);
  if (!schedule) notFound();

  // In-circuit candidate pool for adding (BRA-94) + per-week swapping (BRA-95).
  const allCandidates = await getScheduleCandidates(session.player);
  const byId = new Map(allCandidates.map((c) => [c.id, c]));
  const existingIds = new Set(schedule.events.map((e) => e.tournamentId));
  const addable = allCandidates.filter(
    (c) =>
      !existingIds.has(c.id) &&
      (!schedule.startDate || c.endDate >= schedule.startDate) &&
      (!schedule.endDate || c.startDate <= schedule.endDate),
  );

  // Legs are keyed to the event they depart after, so they align even when
  // some events are same-week conflicts (excluded from the path).
  const legByAfter = new Map(schedule.legs.map((l) => [l.afterTournamentId, l]));

  return (
    <div>
      <Link href="/schedules" className="text-sm text-gray-500 underline">
        ← My Schedules
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <RenameName id={schedule.id} initialName={schedule.name} />
        <div className="flex items-center gap-2">
          <Link
            href={`/schedules/${schedule.id}/edit`}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-400"
          >
            Edit
          </Link>
          <form action={deleteScheduleAction.bind(null, schedule.id)}>
            <button
              type="submit"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-red-300 hover:text-red-600"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {schedule.startDate && schedule.endDate
          ? formatDateRange(schedule.startDate, schedule.endDate)
          : "No dates set"}{" "}
        · {schedule.events.length} events
      </p>

      {schedule.conflictCount > 0 && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {schedule.conflictCount} event{schedule.conflictCount > 1 ? "s" : ""} overlap the same week
          as another — a player can only play one at a time, so they&apos;re flagged below and
          excluded from the totals. Remove them to resolve.
        </p>
      )}

      {schedule.circuitMismatchCount > 0 && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {schedule.circuitMismatchCount} event{schedule.circuitMismatchCount > 1 ? "s" : ""} aren&apos;t
          in your circuit (from before circuit scoping) — flagged below and excluded from the totals.
          Remove them to clean up this schedule.
        </p>
      )}

      {/* Totals — expected value (round-reached), net of costs. */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-gray-200 p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-gray-500">Expected Points</div>
          <div className="font-medium">{schedule.totals.expectedPoints}</div>
        </div>
        <div>
          <div className="text-gray-500">Expected Prize</div>
          <div className="font-medium">{formatMoney(schedule.totals.expectedPrize)}</div>
        </div>
        <div>
          <div className="text-gray-500">Est. Travel</div>
          <div className="font-medium">
            {formatTravelTime(schedule.totals.travelTimeMin)} · {formatMoney(schedule.totals.travelCost)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Trip Costs (lodging, food…)</div>
          <TripCosts id={schedule.id} initial={schedule.tripCosts} />
        </div>
        <div className="sm:col-span-2">
          <div className="text-gray-500">Net After Costs</div>
          <div
            className={`text-lg font-semibold ${
              schedule.totals.netEarnings < 0 ? "text-red-600" : "text-green-700"
            }`}
          >
            {formatMoney(schedule.totals.netEarnings)}
          </div>
          <div className="text-xs text-gray-400">
            Expected prize − estimated travel − trip costs
          </div>
        </div>
      </div>

      {schedule.events.length === 0 ? (
        <p className="mt-6 text-gray-500">
          No events left in this schedule.{" "}
          <Link href="/schedules/new" className="underline">
            Create a new one
          </Link>
          .
        </p>
      ) : (
        <ol className="mt-6 flex flex-col gap-4">
          {schedule.events.map((e) => {
            const leg = legByAfter.get(e.tournamentId);
            const current = byId.get(e.tournamentId);
            // This week's alternatives: same-week, in-circuit, not already added.
            const alternatives = current
              ? allCandidates.filter(
                  (c) => c.id !== current.id && !existingIds.has(c.id) && eventsOverlap(c, current),
                )
              : [];
            return (
              <li key={e.tournamentId} className="flex flex-col gap-3">
                <EventRow scheduleId={schedule.id} e={e} />
                {current && (
                  <SwapEvent scheduleId={schedule.id} current={current} alternatives={alternatives} />
                )}
                {leg && <LegModeControl scheduleId={schedule.id} leg={leg} />}
              </li>
            );
          })}
        </ol>
      )}

      <AddEvents scheduleId={schedule.id} candidates={addable} />
    </div>
  );
}
