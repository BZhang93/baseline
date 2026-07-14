"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/player";
import { createSchedule, type CreateScheduleInput } from "@/lib/schedules";

// Returned string is an error message shown to the user; success redirects.
export async function createScheduleAction(
  input: CreateScheduleInput,
): Promise<string | void> {
  const session = await getCurrentSession();
  if (!session) return "You're not signed in.";

  if (!input.name?.trim()) return "Give your schedule a name.";
  if (!input.tournamentIds || input.tournamentIds.length === 0) {
    return "Add at least one tournament.";
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return "End date can't be before the start date.";
  }

  const id = await createSchedule(session.player.id, input);
  revalidatePath("/schedules");
  redirect(`/schedules?created=${id}`);
}
