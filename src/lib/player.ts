import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Prisma } from "@/generated/prisma/client";
import type { Player } from "@/generated/prisma/client";

export interface CurrentSession {
  userId: string;
  email: string | null;
  player: Player;
}

// Returns the signed-in user together with their Player profile, creating the
// Player on first access (one profile per Supabase auth user). Returns null if
// not authenticated. Profile fields are filled in later via onboarding (BRA-38).
//
// Wrapped in React `cache()` so multiple callers within one request (e.g. the
// app layout and a page) share a single result instead of re-hitting the DB.
// Reads the Player and only writes when creating it — no write on every load.
export const getCurrentSession = cache(
  async (): Promise<CurrentSession | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const player = await getOrCreatePlayer(user.id);

    return { userId: user.id, email: user.email ?? null, player };
  },
);

// One Player per auth user. The common path is a read (no write on load); the
// Player is created on first access. Two concurrent first requests from the same
// new user can both miss the findUnique and race the create — the loser then hits
// the `userId` unique constraint (P2002). We swallow that specific conflict and
// re-read, so a brand-new user is never shown a 500 mid-onboarding.
async function getOrCreatePlayer(userId: string): Promise<Player> {
  const existing = await prisma.player.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    // Name starts empty so onboarding requires the player's real name (email is
    // prefilled separately from the auth identity).
    return await prisma.player.create({ data: { userId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await prisma.player.findUnique({ where: { userId } });
      if (raced) return raced;
    }
    throw e;
  }
}

// The three fields onboarding requires before the app is usable (BRA-101).
export function isProfileComplete(player: Player): boolean {
  return !!player.name?.trim() && player.circuit != null && player.ranking != null;
}

// Where to land a player after auth: onboarding until their profile is
// complete, then Browse until they have a schedule, then My Schedules.
export async function resolveLandingPath(player: Player): Promise<string> {
  if (!isProfileComplete(player)) return "/profile";
  const scheduleCount = await prisma.schedule.count({ where: { playerId: player.id } });
  return scheduleCount > 0 ? "/schedules" : "/browse";
}
