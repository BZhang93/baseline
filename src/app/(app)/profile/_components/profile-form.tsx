"use client";

import { useState, useTransition } from "react";
// Import enums from the client-safe generated entry (not "/client", which pulls
// server-only runtime into the browser bundle).
import { Tour, Surface, BudgetTier } from "@/generated/prisma/enums";
import { formatSurface, capitalize } from "@/lib/format";
import type { ProfileInput } from "@/lib/profile";
import { updateProfileAction } from "../actions";

function csv(values: string[]): string {
  return values.join(", ");
}
function parseCsv(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function numberOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const RANKING_TOURS = [Tour.ATP, Tour.WTA] as const;

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const [name, setName] = useState(initial.name ?? "");
  const [ranking, setRanking] = useState(initial.ranking?.toString() ?? "");
  const [rankingTour, setRankingTour] = useState<string>(initial.rankingTour ?? "");
  const [nationality, setNationality] = useState(csv(initial.nationality));
  const [homeBaseCity, setHomeBaseCity] = useState(initial.homeBaseCity ?? "");
  const [surfacePrefs, setSurfacePrefs] = useState<Surface[]>(initial.surfacePrefs);
  const [budgetTier, setBudgetTier] = useState<string>(initial.budgetTier ?? "");
  const [dietaryPrefs, setDietaryPrefs] = useState(csv(initial.dietaryPrefs));
  const [maxDistance, setMaxDistance] = useState(
    initial.maxDistanceToVenueKm?.toString() ?? "",
  );
  const [lodgingAmenities, setLodgingAmenities] = useState(csv(initial.lodgingAmenities));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleSurface(s: Surface) {
    setSurfacePrefs((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    const input: ProfileInput = {
      name: name.trim() || null,
      ranking: numberOrNull(ranking),
      rankingTour: (rankingTour || null) as Tour | null,
      nationality: parseCsv(nationality),
      homeBaseCity: homeBaseCity.trim() || null,
      surfacePrefs,
      budgetTier: (budgetTier || null) as BudgetTier | null,
      dietaryPrefs: parseCsv(dietaryPrefs),
      maxDistanceToVenueKm: numberOrNull(maxDistance),
      lodgingAmenities: parseCsv(lodgingAmenities),
    };
    startTransition(async () => {
      const message = await updateProfileAction(input);
      if (message) setError(message);
      else setSaved(true);
    });
  }

  const field = "rounded border border-gray-300 px-3 py-2 text-sm";
  const label = "flex flex-col gap-1 text-sm";

  return (
    <div className="mt-6 flex max-w-xl flex-col gap-4">
      <label className={label}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Ranking
          <input
            type="number"
            min={1}
            value={ranking}
            onChange={(e) => setRanking(e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Ranking tour
          <select
            value={rankingTour}
            onChange={(e) => setRankingTour(e.target.value)}
            className={field}
          >
            <option value="">—</option>
            {RANKING_TOURS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Set your ranking + tour to see how far you are from each event&apos;s cutoff on Browse.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Home base city
          <input
            value={homeBaseCity}
            onChange={(e) => setHomeBaseCity(e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Nationality (codes, comma-separated)
          <input
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="HR, US"
            className={field}
          />
        </label>
      </div>

      <fieldset className={label}>
        <span>Surface preferences</span>
        <div className="flex flex-wrap gap-3">
          {Object.values(Surface).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={surfacePrefs.includes(s)}
                onChange={() => toggleSurface(s)}
              />
              {formatSurface(s)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Budget tier
          <select
            value={budgetTier}
            onChange={(e) => setBudgetTier(e.target.value)}
            className={field}
          >
            <option value="">—</option>
            {Object.values(BudgetTier).map((b) => (
              <option key={b} value={b}>
                {capitalize(b)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Max distance to venue (km)
          <input
            type="number"
            min={0}
            value={maxDistance}
            onChange={(e) => setMaxDistance(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <label className={label}>
        Dietary preferences (comma-separated)
        <input
          value={dietaryPrefs}
          onChange={(e) => setDietaryPrefs(e.target.value)}
          placeholder="gluten-free, vegetarian"
          className={field}
        />
      </label>

      <label className={label}>
        Lodging amenities (comma-separated)
        <input
          value={lodgingAmenities}
          onChange={(e) => setLodgingAmenities(e.target.value)}
          placeholder="kitchen, laundry"
          className={field}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        onClick={save}
        disabled={isPending}
        className="w-fit rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
