"use client";

import { useState, useTransition } from "react";
import {
  Tour,
  Surface,
  BudgetTier,
  UnitSystem,
  Circuit,
  TransportMode,
  LodgingType,
} from "@/generated/prisma/enums";
import {
  capitalize,
  kmToMi,
  miToKm,
  formatTour,
  formatTransportMode,
  formatLodgingType,
} from "@/lib/format";
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
const ALL_TRANSPORT = Object.values(TransportMode);
const ALL_LODGING = Object.values(LodgingType);

const distanceUnit = (u: UnitSystem) => (u === UnitSystem.IMPERIAL ? "mi" : "km");

export function ProfileForm({
  initial,
  email,
}: {
  initial: ProfileInput;
  email: string | null;
}) {
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
  const [transportModes, setTransportModes] = useState<TransportMode[]>(initial.transportModes);
  const [lodgingTypes, setLodgingTypes] = useState<LodgingType[]>(initial.lodgingTypes);
  const [travelSpend, setTravelSpend] = useState(initial.travelSpend);
  const [lodgingSpend, setLodgingSpend] = useState(initial.lodgingSpend);
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

  function addTransport(m: TransportMode) {
    setTransportModes((prev) => (prev.includes(m) ? prev : [...prev, m]));
  }
  function removeTransport(m: TransportMode) {
    setTransportModes((prev) => prev.filter((x) => x !== m));
  }
  function moveTransport(index: number, dir: -1 | 1) {
    setTransportModes((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function toggleLodging(t: LodgingType) {
    setLodgingTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }
  const availableTransport = ALL_TRANSPORT.filter((m) => !transportModes.includes(m));

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
      transportModes,
      lodgingTypes,
      travelSpend,
      lodgingSpend,
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
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          Email
          <input
            value={email ?? ""}
            readOnly
            disabled
            className={`${field} bg-gray-50 text-gray-500`}
          />
        </label>
      </div>

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

      <div className="mt-2 border-t border-gray-200 pt-4">
        <h2 className="text-sm font-medium">Travel &amp; Lodging</h2>

        {/* Transport modes — ranked */}
        <fieldset className={`${label} mt-3`}>
          <span>Transport modes, in order of preference</span>
          {transportModes.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">Add the modes you&apos;ll take.</p>
          ) : (
            <ol className="mt-1 flex flex-col gap-2">
              {transportModes.map((m, i) => (
                <li
                  key={m}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-1.5 text-sm"
                >
                  <span>
                    <span className="text-gray-400">{i + 1}.</span> {formatTransportMode(m)}
                  </span>
                  <span className="flex items-center gap-2 text-gray-500">
                    <button
                      type="button"
                      onClick={() => moveTransport(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTransport(i, 1)}
                      disabled={i === transportModes.length - 1}
                      aria-label="Move down"
                      className="disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTransport(m)}
                      className="text-xs hover:text-red-600"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {availableTransport.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {availableTransport.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => addTransport(m)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  + {formatTransportMode(m)}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {/* Lodging types */}
        <fieldset className={`${label} mt-4`}>
          <span>Lodging types</span>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
            {ALL_LODGING.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={lodgingTypes.includes(t)}
                  onChange={() => toggleLodging(t)}
                />
                {formatLodgingType(t)}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Spend sliders */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className={label}>
            <span>Travel spend</span>
            <input
              type="range"
              min={0}
              max={100}
              value={travelSpend}
              onChange={(e) => setTravelSpend(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Save</span>
              <span>Spend</span>
            </div>
          </div>
          <div className={label}>
            <span>Lodging spend</span>
            <input
              type="range"
              min={0}
              max={100}
              value={lodgingSpend}
              onChange={(e) => setLodgingSpend(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Save</span>
              <span>Spend</span>
            </div>
          </div>
        </div>
      </div>

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
