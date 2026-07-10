import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "proxy" (formerly middleware). Runs before requests to refresh the
// Supabase session and guard protected routes.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on page routes only — skip Next.js internals, static assets, and API
  // routes. API routes manage auth via their own server client, so they don't
  // need the session-refresh/route-guard proxy (and the health check shouldn't
  // depend on Supabase Auth being reachable).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
