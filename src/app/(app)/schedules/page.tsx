import Link from "next/link";

export default function SchedulesPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Schedules</h1>
        <Link
          href="/schedules/new"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          Create schedule
        </Link>
      </div>
      <p className="mt-4 text-gray-500">
        Your saved schedules will appear here. The list and detail views land in
        BRA-42.
      </p>
    </div>
  );
}
