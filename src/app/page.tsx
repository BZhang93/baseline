import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold">Baseline</h1>
        <p className="mt-2 text-gray-500">
          Tour logistics for professional tennis players — minimize travel time
          and cost, maximize points and prize money.
        </p>
      </div>
      <div>
        <Link
          href="/login"
          className="inline-block rounded bg-black px-5 py-2.5 text-white"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
