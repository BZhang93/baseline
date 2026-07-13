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
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const player = await prisma.player.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, name: user.email ?? null },
  });

  return { userId: user.id, email: user.email ?? null, player };
}
