"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/player";
import {
  createSchedule,
  renameSchedule,
  updateScheduleTripCosts,
  removeEventFromSchedule,
  deleteSchedule,
  type CreateScheduleInput,
} from "@/lib/schedules";

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
  redirect(`/schedules/${id}`);
}

export async function renameScheduleAction(
  id: string,
  name: string,
): Promise<string | void> {
  const session = await getCurrentSession();
  if (!session) return "You're not signed in.";
  if (!name.trim()) return "Name can't be empty.";
  const ok = await renameSchedule(session.player.id, id, name.trim());
  if (!ok) return "Schedule not found.";
  revalidatePath(`/schedules/${id}`);
  revalidatePath("/schedules");
}

export async function updateTripCostsAction(id: string, tripCosts: number): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await updateScheduleTripCosts(session.player.id, id, tripCosts);
  revalidatePath(`/schedules/${id}`);
  revalidatePath("/schedules");
}

// Bound as a form action: (id, tournamentId) with FormData appended + ignored.
export async function removeEventAction(id: string, tournamentId: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await removeEventFromSchedule(session.player.id, id, tournamentId);
  revalidatePath(`/schedules/${id}`);
  revalidatePath("/schedules");
}

export async function deleteScheduleAction(id: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await deleteSchedule(session.player.id, id);
  revalidatePath("/schedules");
  redirect("/schedules");
}
