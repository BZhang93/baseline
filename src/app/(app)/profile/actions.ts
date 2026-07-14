"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/player";
import { updatePlayerProfile, validateProfile, type ProfileInput } from "@/lib/profile";

export async function updateProfileAction(
  input: ProfileInput,
): Promise<string | void> {
  const session = await getCurrentSession();
  if (!session) return "You're not signed in.";

  const error = validateProfile(input);
  if (error) return error;

  await updatePlayerProfile(session.player.id, input);
  // Refresh the profile plus anywhere the ranking/prefs affect display.
  revalidatePath("/profile");
  revalidatePath("/browse");
  revalidatePath("/schedules", "layout");
}
