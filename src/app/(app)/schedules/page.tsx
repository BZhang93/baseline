import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { getPlayerSchedules, type ScheduleSummary } from "@/lib/schedules";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtWindow(start: Date | null, end: Date | null): string {
  if (!start || !end) return "No dates set";
  const s = `${MONTH[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${end.getUTCDate()}`
      : `${MONTH[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${s}–${e}`;
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtTravelTime(min: number | null): string {
  if (min == null || min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ScheduleCard({ s }: { s: ScheduleSummary }) {
  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{s.name}</h3>
        <span className="text-sm text-gray-500">{s.eventCount} events</span>
      </div>
      <p className="text-sm text-gray-500">{fmtWindow(s.startDate, s.endDate)}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <div className="text-gray-500">Potential pts</div>
          <div>{s.potentialPoints ?? "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">Potential prize</div>
          <div>{fmtMoney(s.potentialPrize)}</div>
        </div>
        <div>
          <div className="text-gray-500">Est. travel</div>
          <div>{fmtTravelTime(s.travelTimeMin)}</div>
        </div>
        <div>
          <div className="text-gray-500">Est. travel cost</div>
          <div>{fmtMoney(s.travelCost)}</div>
        </div>
      </div>
    </li>
  );
}

export default async function SchedulesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const schedules = await getPlayerSchedules(session.player.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Schedules</h1>
        <Link
          href="/schedules/new"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Create schedule
        </Link>
      </div>

      {schedules.length === 0 ? (
        <p className="mt-6 text-gray-500">
          No schedules yet.{" "}
          <Link href="/schedules/new" className="underline">
            Create your first
          </Link>{" "}
          to start planning. (Potential points/prize assume you win each event;
          the detail view + editing land in BRA-42.)
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
