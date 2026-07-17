import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/player";
import { getScheduleForEdit, getScheduleCandidates } from "@/lib/schedules";
import { CreateScheduleForm } from "../../_components/create-schedule-form";

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const [edit, candidates] = await Promise.all([
    getScheduleForEdit(session.player.id, id),
    getScheduleCandidates(session.player),
  ]);
  if (!edit) notFound();

  return (
    <div>
      <Link href={`/schedules/${id}`} className="text-sm text-gray-500 underline">
        ← Back to schedule
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit Schedule</h1>
      <p className="mt-1 text-sm text-gray-500">
        Add or remove events and adjust your window, constraints, and priority.
        Totals recompute as you go.
      </p>
      <div className="mt-6">
        <CreateScheduleForm
          scheduleId={id}
          candidates={candidates}
          initial={edit}
          initialSelectedIds={edit.eventIds}
          preferredTransport={session.player.transportModes[0] ?? null}
        />
      </div>
    </div>
  );
}
