import Link from "next/link";
import { getCurrentSession } from "@/lib/player";
import {
  getBrowseData,
  getFilterOptions,
  resolveBrowseDates,
  type BrowseFilters,
} from "@/lib/tournaments";
import { Tour, Surface } from "@/generated/prisma/client";
import { resolveBrowseTours } from "@/lib/circuit";
import { formatSurface, formatTour } from "@/lib/format";
import { BrowseResults } from "./_components/browse-results";

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

const TOURS = Object.values(Tour) as string[];
const SURFACES = Object.values(Surface) as string[];

function parseFilters(sp: SearchParams): BrowseFilters {
  const tour = str(sp.tour);
  const surface = str(sp.surface);
  return {
    q: str(sp.q),
    // Validate against the enum's values (not `in`, which would also match
    // prototype keys like "toString"/"constructor").
    tour: tour && TOURS.includes(tour) ? (tour as Tour) : undefined,
    surface: surface && SURFACES.includes(surface) ? (surface as Surface) : undefined,
    from: str(sp.from),
    to: str(sp.to),
    country: str(sp.country),
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [session, { countries, surfaces }] = await Promise.all([
    getCurrentSession(),
    getFilterOptions(),
  ]);
  const player = session?.player ?? null;

  // Personalize the Tour filter to the player's circuit and tours.
  const {
    tour,
    tours,
    options: circuitTours,
  } = resolveBrowseTours({
    circuit: player?.circuit ?? null,
    playerTours: player?.tours ?? [],
    selectedTour: filters.tour,
    tourExplicit: sp.tour !== undefined,
  });
  filters.tour = tour;
  filters.tours = tours;

  // Default the date window to today → year-end; an absent param (fresh visit
  // or Clear) falls back to the default, a cleared field means no bound.
  const rawFrom = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const rawTo = Array.isArray(sp.to) ? sp.to[0] : sp.to;
  const { from, to } = resolveBrowseDates(rawFrom, rawTo, new Date());
  filters.from = from;
  filters.to = to;

  const tournaments = await getBrowseData(filters, player);

  // Fixed height so text inputs, selects, and date pickers line up (native
  // selects otherwise render a different height).
  const inputClass = "h-9 rounded border border-gray-300 px-2 text-sm";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Browse Tournaments</h1>
      <p className="mt-1 text-sm text-gray-500">July 2026 · {tournaments.length} events</p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search name / city / country"
          className={`${inputClass} min-w-52 flex-1`}
        />
        <select name="tour" defaultValue={filters.tour ?? ""} className={inputClass}>
          <option value="">All tours</option>
          {circuitTours.map((v) => (
            <option key={v} value={v}>
              {formatTour(v)}
            </option>
          ))}
        </select>
        <select name="surface" defaultValue={filters.surface ?? ""} className={inputClass}>
          <option value="">All surfaces</option>
          {surfaces.map((v) => (
            <option key={v} value={v}>
              {formatSurface(v)}
            </option>
          ))}
        </select>
        <select name="country" defaultValue={filters.country ?? ""} className={inputClass}>
          <option value="">All regions</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={filters.from ?? ""} className={inputClass} />
        <input type="date" name="to" defaultValue={filters.to ?? ""} className={inputClass} />
        <button type="submit" className="h-9 rounded bg-black px-3 text-sm text-white">
          Update
        </button>
        <Link
          href="/browse"
          className="flex h-9 items-center px-2 text-sm text-gray-500 underline"
        >
          Clear
        </Link>
      </form>

      {session?.player.ranking == null && (
        <p className="mt-3 text-xs text-gray-500">
          Set your ranking in <Link href="/profile" className="underline">Profile</Link> to see
          how far you are from each cutoff.
        </p>
      )}

      <BrowseResults tournaments={tournaments} />
    </div>
  );
}
