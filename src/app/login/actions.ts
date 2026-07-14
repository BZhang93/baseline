"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  redirect("/schedules");
}

export async function signup(formData: FormData): Promise<AuthResult | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

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
  redirect("/schedules");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
