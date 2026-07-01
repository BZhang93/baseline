import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request and keeps the auth
// cookies in sync between the browser and the server. Called from src/proxy.ts.
//
// In Next.js 16 the former "middleware" convention is called "proxy"; the
// behaviour is the same. See node_modules/next/dist/docs/.../16-proxy.md.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser(). A
  // simple mistake could make it very hard to debug intermittent logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate authenticated areas. Unauthenticated users hitting a protected route
  // are redirected to /login. Public routes (home, login, auth callback) pass
  // through.
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard");
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
