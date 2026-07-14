import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";
import { logout } from "@/app/login/actions";
import { AppNav } from "./_components/app-nav";

// Shared layout for all authenticated app routes. The proxy already redirects
// unauthenticated users to /login; we re-check here and use the session to
// ensure the Player exists and show who's signed in.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/schedules" className="text-lg font-semibold">
            Baseline
          </Link>
          <AppNav />
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/schedules/new"
              className="rounded bg-black px-3 py-1.5 text-sm text-white"
            >
              Create schedule
            </Link>
            <span className="hidden text-sm text-gray-500 sm:inline">
              {session.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
