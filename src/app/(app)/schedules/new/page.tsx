import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { getScheduleCandidates, parseEventIdsParam } from "@/lib/schedules";
import { CreateScheduleForm } from "../_components/create-schedule-form";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const candidates = await getScheduleCandidates(session.player);

  const eventsParam = Array.isArray(sp.events) ? sp.events[0] : sp.events;
  const initialSelectedIds = parseEventIdsParam(
    eventsParam,
    candidates.map((t) => t.id),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Create Schedule</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set your window and constraints, then let Baseline suggest a schedule —
        or add events yourself. Travel time and cost are estimated between events.
      </p>
      <div className="mt-6">
        <CreateScheduleForm
          candidates={candidates}
          initialSelectedIds={initialSelectedIds}
          transportModes={session.player.transportModes}
        />
      </div>
    </div>
  );
}
