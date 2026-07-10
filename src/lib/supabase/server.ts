import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

// Supabase client for use in Server Components, Server Actions, and Route
// Handlers. Reads/writes the auth session via Next.js cookies.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component. This can
          // be ignored if there is a proxy (middleware) refreshing user
          // sessions — which there is (src/proxy.ts).
        }
      },
    },
  });
}
