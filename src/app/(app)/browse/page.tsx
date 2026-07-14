import Link from "next/link";
import { getCurrentSession } from "@/lib/player";
import {
  getBrowseData,
  getFilterCountries,
  type BrowseFilters,
  type GapView,
  type TournamentView,
} from "@/lib/tournaments";
import { Tour, Surface } from "@/generated/prisma/client";

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

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDates(start: Date, end: Date): string {
  const s = `${MONTH[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${end.getUTCDate()}`
      : `${MONTH[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${s}–${e}`;
}

function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function GapBadge({ gap }: { gap: GapView }) {
  const styles: Record<GapView["status"], string> = {
    in: "bg-green-100 text-green-800",
    borderline: "bg-amber-100 text-amber-800",
    out: "bg-red-100 text-red-800",
    unknown: "bg-gray-100 text-gray-600",
  };
  const label =
    gap.status === "in"
      ? "You're in"
      : gap.status === "borderline"
        ? `Borderline · ${gap.spots} spots`
        : gap.status === "out"
          ? `${gap.spots} spots${gap.points != null ? ` · ${gap.points} pts` : ""} short`
          : "Set ranking";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[gap.status]}`}>
      {label}
    </span>
  );
}

function EventCard({ t }: { t: TournamentView }) {
  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{t.name}</h3>
          <p className="text-sm text-gray-500">
            {t.city}, {t.country} · {fmtDates(t.startDate, t.endDate)}
          </p>
        </div>
        <GapBadge gap={t.gap} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{t.tour}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{t.tier.replaceAll("_", " ")}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700 capitalize">
          {t.surface.toLowerCase()}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">Draw {t.drawSize}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <div className="text-gray-500">Winner</div>
          <div>{t.winnerPoints != null ? `${t.winnerPoints} pts` : "—"}</div>
        </div>
        <div>
          <div className="text-gray-500">Prize (W)</div>
          <div>{fmtMoney(t.winnerPrize, t.currency)}</div>
        </div>
        <div>
          <div className="text-gray-500">Live cutoff</div>
          <div>
            {t.liveCutoff.rank != null ? `#${t.liveCutoff.rank}` : "—"}
            {t.liveCutoff.points != null ? ` · ${t.liveCutoff.points} pts` : ""}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Last year</div>
          <div>{t.historicalCutoff.rank != null ? `#${t.historicalCutoff.rank}` : "—"}</div>
        </div>
      </div>
    </li>
  );
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [session, countries] = await Promise.all([
    getCurrentSession(),
    getFilterCountries(),
  ]);
  const tournaments = await getBrowseData(filters, session?.player ?? null);

  const inputClass = "rounded border border-gray-300 px-2 py-1.5 text-sm";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Browse tournaments</h1>
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
          {Object.values(Tour).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select name="surface" defaultValue={filters.surface ?? ""} className={inputClass}>
          <option value="">All surfaces</option>
          {Object.values(Surface).map((v) => (
            <option key={v} value={v} className="capitalize">
              {v.toLowerCase()}
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
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-sm text-white">
          Filter
        </button>
        <Link href="/browse" className="px-2 py-1.5 text-sm text-gray-500 underline">
          Clear
        </Link>
      </form>

      {session?.player.ranking == null && (
        <p className="mt-3 text-xs text-gray-500">
          Set your ranking in <Link href="/profile" className="underline">Profile</Link> to see
          how far you are from each cutoff.
        </p>
      )}

      {tournaments.length === 0 ? (
        <p className="mt-8 text-gray-500">No tournaments match these filters.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {tournaments.map((t) => (
            <EventCard key={t.id} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
