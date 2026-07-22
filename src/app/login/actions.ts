"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSession, resolveLandingPath } from "@/lib/player";

// Result surfaced back to the login page. On success the action redirects and
// never returns a value.
export type AuthResult =
  | { status: "error"; message: string }
  | { status: "confirm-email" };

export async function login(formData: FormData): Promise<AuthResult | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: error.message };
  }

  // Clear cached, user-specific content across the auth-state change.
  revalidatePath("/", "layout");
  const session = await getCurrentSession();
  redirect(session ? await resolveLandingPath(session.player) : "/schedules");
}

export async function signup(formData: FormData): Promise<AuthResult | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  // Point the confirmation email at THIS deployment's callback route (dev,
  // preview, or prod) rather than Supabase's fixed Site URL. Must be listed in
  // the project's Auth → Redirect URLs allowlist or Supabase ignores it.
  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // When email confirmation is enabled (Supabase's default), signUp succeeds
  // but returns no session — the user must confirm via email before they can
  // sign in. Tell them, rather than redirecting into an authed route, which the
  // proxy would just bounce back to /login with no explanation.
  if (!data.session) {
    return { status: "confirm-email" };
  }

  revalidatePath("/", "layout");
  const session = await getCurrentSession();
  redirect(session ? await resolveLandingPath(session.player) : "/schedules");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
