import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

// Protected page. The proxy (src/proxy.ts) already redirects unauthenticated
// users to /login; we re-check here as defense in depth and to read the user.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Signed in as {user.email}. This is a placeholder — the calendar and
          schedule creator land in later tickets.
        </p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="rounded border border-black px-4 py-2 text-sm"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
