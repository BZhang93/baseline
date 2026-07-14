import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/player";

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Profile</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 text-gray-500">Email</dt>
          <dd>{session.email ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 text-gray-500">Name</dt>
          <dd>{session.player.name ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 text-gray-500">Ranking</dt>
          <dd>{session.player.ranking ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-6 text-gray-500">
        Editing your ranking, home base, and preferences lands in BRA-38.
      </p>
    </div>
  );
}
