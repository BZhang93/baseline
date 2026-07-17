import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { getPlayerSchedules, type ScheduleSummary } from "@/lib/schedules";
import { formatDateRange, formatMoney } from "@/lib/format";

function fmtWindow(start: Date | null, end: Date | null): string {
  return start && end ? formatDateRange(start, end) : "No dates set";
}

function ScheduleCard({ s }: { s: ScheduleSummary }) {
  return (
    <li>
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
    </li>
  );
}

export default async function SchedulesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const schedules = await getPlayerSchedules(session.player.id, session.player);

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

      {schedules.length === 0 ? (
        <p className="mt-6 text-gray-500">
          You haven&apos;t planned any schedules yet.{" "}
          <Link href="/schedules/new" className="underline">
            Create your first
          </Link>{" "}
          to start mapping out your season. Points and prize are expected values
          based on your ranking, net of estimated travel and your trip costs.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {schedules.map((s) => (
            <ScheduleCard key={s.id} s={s} />
          ))}
        </ul>
      )}
    </div>
  );
}
