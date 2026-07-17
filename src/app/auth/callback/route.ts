import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Email-confirmation / auth redirect target. Supabase sends the user here with
// a `code` (PKCE); we exchange it for a session cookie, then send the now
// signed-in user into the app. Without this route the confirmation link lands
// on a dangling `?code=…` and the session is never established.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only allow an internal, non-protocol-relative `next` (avoids open redirect).
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/schedules";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Behind Vercel the request's internal origin isn't the public URL —
      // prefer the forwarded host outside local dev.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      const base = !isLocal && forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  // No code, or the exchange failed (expired/invalid link).
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
