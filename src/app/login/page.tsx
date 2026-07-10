"use client";

import { useState, useTransition } from "react";
import { login, signup, type AuthResult } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(action: (fd: FormData) => Promise<AuthResult | void>) {
    return (formData: FormData) => {
      setError(null);
      setNotice(null);
      startTransition(async () => {
        const result = await action(formData);
        if (result?.status === "error") {
          setError(result.message);
        } else if (result?.status === "confirm-email") {
          setNotice("Check your email to confirm your account, then log in.");
        }
      });
    };
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Baseline</h1>
        <p className="text-sm text-gray-500">
          Sign in or create an account to start planning.
        </p>
      </div>

      <form className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            formAction={handle(login)}
            disabled={isPending}
            className="flex-1 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            Log in
          </button>
          <button
            type="submit"
            formAction={handle(signup)}
            disabled={isPending}
            className="flex-1 rounded border border-black px-4 py-2 disabled:opacity-50"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
