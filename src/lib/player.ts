import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
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

    const player =
      (await prisma.player.findUnique({ where: { userId: user.id } })) ??
      (await prisma.player.create({
        data: { userId: user.id, name: user.email ?? null },
      }));

    return { userId: user.id, email: user.email ?? null, player };
  },
);
