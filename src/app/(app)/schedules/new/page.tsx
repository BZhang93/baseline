import { getTournamentsForPicker } from "@/lib/schedules";
import { CreateScheduleForm } from "../_components/create-schedule-form";

export default async function NewSchedulePage() {
  const tournaments = await getTournamentsForPicker();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Create schedule</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set your window and constraints, then add tournaments. Travel time and
        cost are estimated between events.
      </p>
      <div className="mt-6">
        <CreateScheduleForm tournaments={tournaments} />
      </div>
    </div>
  );
}
