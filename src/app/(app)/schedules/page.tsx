import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { getPlayerSchedules, type ScheduleSummary } from "@/lib/schedules";
import { formatDateRange, formatMoney } from "@/lib/format";
import { unarchiveScheduleAction } from "./actions";

function fmtWindow(start: Date | null, end: Date | null): string {
  return start && end ? formatDateRange(start, end) : "No dates set";
}

function ScheduleCardLink({ s }: { s: ScheduleSummary }) {
  return (
    <Link
      href={`/schedules/${s.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:border-gray-400"
    >
        <div className="flex items-baseline justify-between">
          <h3 className="font-medium">{s.name}</h3>
          <span className="text-sm text-gray-500">{s.eventCount} events</span>
        </div>
        <p className="text-sm text-gray-500">{fmtWindow(s.startDate, s.endDate)}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <div className="text-gray-500">Exp. Points</div>
            <div>{s.expectedPoints}</div>
          </div>
          <div>
            <div className="text-gray-500">Exp. Prize</div>
            <div>{formatMoney(s.expectedPrize)}</div>
          </div>
          <div>
            <div className="text-gray-500">Est. Travel</div>
            <div>{formatMoney(s.travelCost)}</div>
          </div>
          <div>
            <div className="text-gray-500">Net After Costs</div>
            <div className={s.netEarnings < 0 ? "text-red-600" : ""}>
              {formatMoney(s.netEarnings)}
            </div>
          </div>
        </div>
    </Link>
  );
}

function ScheduleCard({ s }: { s: ScheduleSummary }) {
  return (
    <li>
      <ScheduleCardLink s={s} />
    </li>
  );
}

export default async function SchedulesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const schedules = await getPlayerSchedules(session.player.id, session.player);
  const active = schedules.filter((s) => s.archivedAt === null);
  const archived = schedules.filter((s) => s.archivedAt !== null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Schedules</h1>
        <Link
          href="/schedules/new"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Create Schedule
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="mt-6 text-gray-500">
          {archived.length > 0
            ? "No active schedules — your archived plans are below."
            : "You haven't planned any schedules yet. "}
          {archived.length === 0 && (
            <>
              <Link href="/schedules/new" className="underline">
                Create your first
              </Link>{" "}
              to start mapping out your season. Points and prize are expected values
              based on your ranking, net of estimated travel and your trip costs.
            </>
          )}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {active.map((s) => (
            <ScheduleCard key={s.id} s={s} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-gray-500">
            Archived ({archived.length})
          </h2>
          <ul className="mt-3 grid gap-3">
            {archived.map((s) => (
              <li key={s.id} className="opacity-70">
                <ScheduleCardLink s={s} />
                <form
                  action={unarchiveScheduleAction.bind(null, s.id)}
                  className="mt-1 flex justify-end"
                >
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center text-xs text-gray-500 underline hover:text-gray-800"
                  >
                    Restore to active
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
