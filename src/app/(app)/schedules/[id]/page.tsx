import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import {
  getScheduleDetail,
  type ScheduleEventView,
  type TravelLegView,
} from "@/lib/schedules";
import { formatDateRange, formatMoney, formatSurface, formatTravelTime } from "@/lib/format";
import { flightSearchUrl, lodgingSearchUrl } from "@/lib/booking-links";
import { GapBadge } from "../../_components/gap-badge";
import { RenameName } from "../_components/rename-name";
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
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{e.name}</h3>
          <p className="text-sm text-gray-500">
            {e.city}, {e.country} · {formatDateRange(e.startDate, e.endDate)}
          </p>
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
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{e.tour}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {e.tier.replaceAll("_", " ")}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {formatSurface(e.surface)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <div className="text-gray-500">Winner</div>
          <div>{e.winnerPoints != null ? `${e.winnerPoints} pts` : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">Prize (Winner)</div>
          <div>{formatMoney(e.winnerPrize, e.currency ?? undefined)}</div>
        </div>
        <div>
          <div className="text-gray-500">Live Cutoff</div>
          <div>
            {e.cutoff.liveCutoff.rank != null ? `#${e.cutoff.liveCutoff.rank}` : "—"}
            {e.cutoff.liveCutoff.points != null ? ` · ${e.cutoff.liveCutoff.points} pts` : ""}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Last Year</div>
          <div>
            {e.cutoff.historicalCutoff.rank != null
              ? `#${e.cutoff.historicalCutoff.rank}`
              : "—"}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <a
          href={lodgingSearchUrl(e.city, e.country, e.startDate)}
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

function LegRow({ leg }: { leg: TravelLegView }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
      <span>✈</span>
      <span>
        {leg.fromLabel} → {leg.toLabel}
      </span>
      <span>·</span>
      <span>{formatTravelTime(leg.durationMinutes)}</span>
      <span>·</span>
      <span>{formatMoney(leg.costEstimate)}</span>
      <a
        href={flightSearchUrl(leg.fromLabel, leg.toLabel)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${externalLink} ml-1`}
      >
        Book flight ↗
      </a>
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

  return (
    <div>
      <Link href="/schedules" className="text-sm text-gray-500 underline">
        ← My Schedules
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <RenameName id={schedule.id} initialName={schedule.name} />
        <form action={deleteScheduleAction.bind(null, schedule.id)}>
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-red-300 hover:text-red-600"
          >
            Delete
          </button>
        </form>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {schedule.startDate && schedule.endDate
          ? formatDateRange(schedule.startDate, schedule.endDate)
          : "No dates set"}{" "}
        · {schedule.events.length} events
      </p>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-gray-200 p-4 text-sm sm:grid-cols-4">
        <div>
          <div className="text-gray-500">Potential Points</div>
          <div>{schedule.totals.points ?? "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">Potential Prize</div>
          <div>{formatMoney(schedule.totals.prize)}</div>
        </div>
        <div>
          <div className="text-gray-500">Est. Travel Time</div>
          <div>{formatTravelTime(schedule.totals.travelTimeMin)}</div>
        </div>
        <div>
          <div className="text-gray-500">Est. Travel Cost</div>
          <div>{formatMoney(schedule.totals.travelCost)}</div>
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
          {schedule.events.map((e, i) => (
            <li key={e.tournamentId} className="flex flex-col gap-3">
              <EventRow scheduleId={schedule.id} e={e} />
              {schedule.legs[i] && <LegRow leg={schedule.legs[i]} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
