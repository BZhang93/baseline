"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server Actions for email/password auth via Supabase.
// Returned strings are surfaced to the user as error messages.

export async function login(formData: FormData): Promise<string | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return error.message;
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData): Promise<string | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return error.message;
  }

  // If email confirmation is enabled in Supabase, the user must confirm before
  // the session is active. Otherwise they're signed in immediately.
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
