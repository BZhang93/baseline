"use client";

import { useState, useTransition } from "react";
import { renameScheduleAction } from "../actions";

export function RenameName({ id, initialName }: { id: string; initialName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-gray-500 underline"
        >
          Rename
        </button>
      </div>
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const err = await renameScheduleAction(id, name);
      if (err) setError(err);
      else setEditing(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-lg"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => {
          setName(initialName);
          setError(null);
          setEditing(false);
        }}
        className="text-sm text-gray-500"
      >
        Cancel
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
