"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/format";
import { updateTripCostsAction } from "../actions";

// Inline-editable trip costs (lodging/food/etc.) feeding net-of-cost earnings.
export function TripCosts({ id, initial }: { id: string; initial: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initial));
  const [saved, setSaved] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function save() {
    const n = Math.max(0, Math.round(Number(value) || 0));
    startTransition(async () => {
      await updateTripCostsAction(id, n);
      setSaved(n);
      setValue(String(n));
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{formatMoney(saved)}</span>
        <button onClick={() => setEditing(true)} className="text-xs text-gray-500 underline">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
