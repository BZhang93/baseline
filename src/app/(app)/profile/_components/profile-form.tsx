"use client";

import { useState, useTransition } from "react";
import { Tour, Surface, BudgetTier, UnitSystem, Circuit } from "@/generated/prisma/enums";
import { capitalize, kmToMi, miToKm, formatTour } from "@/lib/format";
import { toursForCircuit } from "@/lib/circuit";
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

const CIRCUIT_OPTIONS: { value: Circuit; label: string }[] = [
  { value: Circuit.MENS, label: "Men's" },
  { value: Circuit.WOMENS, label: "Women's" },
];

// Carpet is excluded — no current events use it.
const SURFACE_OPTIONS = Object.values(Surface).filter((s) => s !== Surface.CARPET);

const distanceUnit = (u: UnitSystem) => (u === UnitSystem.IMPERIAL ? "mi" : "km");

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const [name, setName] = useState(initial.name ?? "");
  const [ranking, setRanking] = useState(initial.ranking?.toString() ?? "");
  const [circuit, setCircuit] = useState<Circuit | "">(initial.circuit ?? "");
  const [tours, setTours] = useState<Tour[]>(initial.tours);
  const [nationality, setNationality] = useState(csv(initial.nationality));
  const [homeBaseCity, setHomeBaseCity] = useState(initial.homeBaseCity ?? "");
  const [homeBaseCountry, setHomeBaseCountry] = useState(initial.homeBaseCountry ?? "");
  const [surfacePrefs, setSurfacePrefs] = useState<Surface[]>(
    // Drop any legacy Carpet pref so it can be removed on the next save.
    initial.surfacePrefs.filter((s) => s !== Surface.CARPET),
  );
  const [budgetTier, setBudgetTier] = useState<string>(initial.budgetTier ?? "");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(initial.unitSystem);
  const [dietaryPrefs, setDietaryPrefs] = useState(csv(initial.dietaryPrefs));
  // Displayed in the player's current unit; converted to km on save.
  const [maxDistance, setMaxDistance] = useState(() => {
    if (initial.maxDistanceToVenueKm == null) return "";
    const v =
      initial.unitSystem === UnitSystem.IMPERIAL
        ? Math.round(kmToMi(initial.maxDistanceToVenueKm))
        : initial.maxDistanceToVenueKm;
    return v.toString();
  });
  const [lodgingAmenities, setLodgingAmenities] = useState(csv(initial.lodgingAmenities));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleSurface(s: Surface) {
    setSurfacePrefs((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  // Changing circuit repopulates the tour options; prune any now-invalid picks.
  function changeCircuit(next: Circuit) {
    const allowed = new Set(toursForCircuit(next));
    setTours((prev) => prev.filter((t) => allowed.has(t)));
    setCircuit(next);
  }

  function toggleTour(t: Tour) {
    setTours((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const tourOptions = circuit === "" ? [] : toursForCircuit(circuit);

  // Switching units converts the current max-distance value once, so the number
  // keeps meaning the same real-world distance.
  function changeUnit(next: UnitSystem) {
    if (next !== unitSystem && maxDistance.trim() !== "") {
      const n = Number(maxDistance);
      if (Number.isFinite(n)) {
        const km = unitSystem === UnitSystem.IMPERIAL ? miToKm(n) : n;
        const converted = next === UnitSystem.IMPERIAL ? kmToMi(km) : km;
        setMaxDistance(String(Math.round(converted)));
      }
    }
    setUnitSystem(next);
  }

  function maxDistanceKm(): number | null {
    const n = numberOrNull(maxDistance);
    if (n == null) return null;
    // Stored as an integer number of km.
    return Math.round(unitSystem === UnitSystem.IMPERIAL ? miToKm(n) : n);
  }

  function save() {
    setError(null);
    setSaved(false);
    const input: ProfileInput = {
      name: name.trim() || null,
      ranking: numberOrNull(ranking),
      circuit: (circuit || null) as Circuit | null,
      tours,
      nationality: parseCsv(nationality),
      homeBaseCity: homeBaseCity.trim() || null,
      homeBaseCountry: homeBaseCountry.trim() || null,
      surfacePrefs,
      budgetTier: (budgetTier || null) as BudgetTier | null,
      unitSystem,
      dietaryPrefs: parseCsv(dietaryPrefs),
      maxDistanceToVenueKm: maxDistanceKm(),
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
        <fieldset className={label}>
          <span>Circuit</span>
          <div className="flex items-center gap-4 py-2">
            {CIRCUIT_OPTIONS.map((c) => (
              <label key={c.value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="circuit"
                  checked={circuit === c.value}
                  onChange={() => changeCircuit(c.value)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {circuit !== "" && (
        <fieldset className={label}>
          <span>Tours</span>
          <div className="flex flex-wrap gap-3">
            {tourOptions.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={tours.includes(t)}
                  onChange={() => toggleTour(t)}
                />
                {formatTour(t)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="-mt-2 text-xs text-gray-500">
        Set your ranking and circuit to see how far you are from each event&apos;s
        cutoff on Browse.
      </p>

      <fieldset className={label}>
        <span>Home Base</span>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={homeBaseCity}
            onChange={(e) => setHomeBaseCity(e.target.value)}
            placeholder="City"
            className={field}
          />
          <input
            value={homeBaseCountry}
            onChange={(e) => setHomeBaseCountry(e.target.value)}
            placeholder="Country"
            className={field}
          />
        </div>
      </fieldset>

      <label className={label}>
        Nationality
        <input
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          placeholder="HR, US"
          className={field}
        />
      </label>

      <fieldset className={label}>
        <span>Surface Preferences</span>
        <div className="flex flex-wrap gap-3">
          {SURFACE_OPTIONS.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={surfacePrefs.includes(s)}
                onChange={() => toggleSurface(s)}
              />
              {capitalize(s)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Budget Tier
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
          Units
          <select
            value={unitSystem}
            onChange={(e) => changeUnit(e.target.value as UnitSystem)}
            className={field}
          >
            <option value={UnitSystem.METRIC}>Metric (km)</option>
            <option value={UnitSystem.IMPERIAL}>Imperial (mi)</option>
          </select>
        </label>
      </div>

      <label className={label}>
        Max Distance to Venue ({distanceUnit(unitSystem)})
        <input
          type="number"
          min={0}
          value={maxDistance}
          onChange={(e) => setMaxDistance(e.target.value)}
          className={field}
        />
      </label>

      <label className={label}>
        Dietary Preferences
        <input
          value={dietaryPrefs}
          onChange={(e) => setDietaryPrefs(e.target.value)}
          placeholder="gluten-free, vegetarian"
          className={field}
        />
      </label>

      <label className={label}>
        Lodging Amenities
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
        {isPending ? "Saving…" : "Save Profile"}
      </button>
    </div>
  );
}
