import { getTournamentsForPicker, parseEventIdsParam } from "@/lib/schedules";
import { CreateScheduleForm } from "../_components/create-schedule-form";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tournaments = await getTournamentsForPicker();

  const eventsParam = Array.isArray(sp.events) ? sp.events[0] : sp.events;
  const initialSelectedIds = parseEventIdsParam(
    eventsParam,
    tournaments.map((t) => t.id),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Create Schedule</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set your window and constraints, then add tournaments. Travel time and
        cost are estimated between events.
      </p>
      <div className="mt-6">
        <CreateScheduleForm
          tournaments={tournaments}
          initialSelectedIds={initialSelectedIds}
        />
      </div>
    </div>
  );
}
