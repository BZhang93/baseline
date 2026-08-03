"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/player";
import {
  createSchedule,
  updateSchedule,
  renameSchedule,
  updateScheduleTripCosts,
  removeEventFromSchedule,
  addEventToSchedule,
  swapScheduleEvent,
  setScheduleLegMode,
  deleteSchedule,
  duplicateSchedule,
  setScheduleArchived,
  type CreateScheduleInput,
} from "@/lib/schedules";
import type { TransportMode } from "@/generated/prisma/enums";
import { aiConfigured, aiChatJson } from "@/lib/ai/client";
import {
  normalizePlanIntent,
  buildPlanUserPrompt,
  PLAN_SYSTEM_PROMPT,
  type PlanIntent,
} from "@/lib/ai/plan-intent";
import {
  normalizeRationales,
  buildRationaleUserPrompt,
  RATIONALE_SYSTEM_PROMPT,
  type PickFact,
  type RationaleContext,
} from "@/lib/ai/rationale";

// AI natural-language front door (BRA-47): turn a plain-language request into
// validated optimizer INPUTS. The LLM never selects events — it only fills the
// knobs the deterministic optimizer already runs on. Returns a normalized
// (sanitized) PlanIntent, or a user-facing error string.
export async function planFromTextAction(
  text: string,
): Promise<{ intent?: PlanIntent; error?: string }> {
  const session = await getCurrentSession();
  if (!session) return { error: "You're not signed in." };
  if (!text.trim()) return { error: "Describe what you're looking for first." };
  if (!aiConfigured()) return { error: "AI planning isn't set up yet." };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = await aiChatJson(
      PLAN_SYSTEM_PROMPT,
      buildPlanUserPrompt(text, {
        today,
        circuit: session.player.circuit,
        tours: session.player.tours,
      }),
    );
    return { intent: normalizePlanIntent(raw) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI planning failed." };
  }
}

// Grounded per-event rationale (BRA-47): the LLM explains each optimizer pick
// from its ACTUAL numbers (passed in), never inventing figures. Returns one
// string per pick, in order.
export async function explainPlanAction(
  picks: PickFact[],
  context: RationaleContext,
): Promise<{ rationales?: string[]; error?: string }> {
  const session = await getCurrentSession();
  if (!session) return { error: "You're not signed in." };
  if (!aiConfigured()) return { error: "AI isn't set up yet." };
  if (picks.length === 0) return { rationales: [] };
  try {
    const raw = await aiChatJson(RATIONALE_SYSTEM_PROMPT, buildRationaleUserPrompt(picks, context));
    return { rationales: normalizeRationales(raw, picks.length) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rationale generation failed." };
  }
}

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

export async function updateScheduleAction(
  id: string,
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

  const ok = await updateSchedule(session.player.id, id, input);
  if (!ok) return "Schedule not found.";
  revalidatePath(`/schedules/${id}`);
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

// Add one event to a saved schedule from its detail view (BRA-94).
export async function addEventAction(scheduleId: string, tournamentId: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await addEventToSchedule(session.player.id, scheduleId, tournamentId);
  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
}

// Swap a scheduled event for another in the same week (BRA-95).
export async function swapEventAction(
  scheduleId: string,
  removeId: string,
  addId: string,
): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await swapScheduleEvent(session.player.id, scheduleId, removeId, addId);
  revalidatePath(`/schedules/${scheduleId}`);
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

// Override (or clear, when mode is null) one leg's transport mode; recomputes
// the schedule's travel + net totals (player-feedback P1-7a).
export async function setLegModeAction(
  scheduleId: string,
  fromTournamentId: string,
  toTournamentId: string,
  mode: TransportMode | null,
): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await setScheduleLegMode(session.player.id, scheduleId, fromTournamentId, toTournamentId, mode);
  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
}

// Clone a schedule and open the copy (BRA-98).
export async function duplicateScheduleAction(id: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  const newId = await duplicateSchedule(session.player.id, id);
  revalidatePath("/schedules");
  if (newId) redirect(`/schedules/${newId}`);
}

export async function deleteScheduleAction(id: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await deleteSchedule(session.player.id, id);
  revalidatePath("/schedules");
  redirect("/schedules");
}

// Archive a schedule (from its detail view) instead of deleting it (BRA-100).
export async function archiveScheduleAction(id: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await setScheduleArchived(session.player.id, id, true);
  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
  redirect("/schedules");
}

// Restore an archived schedule back to the active list (BRA-100).
export async function unarchiveScheduleAction(id: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  await setScheduleArchived(session.player.id, id, false);
  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
}
