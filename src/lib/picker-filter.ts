import type { PickerTournament } from "@/lib/schedules";

// Client-safe (no DB import): pure filtering over the tournament list already
// loaded into the create-schedule picker. Type-only import of PickerTournament
// is erased, so this stays out of the server bundle.

export interface PickerFilters {
  q: string;
  tour: string;
  surface: string;
  country: string;
  from: string; // ISO date (yyyy-mm-dd) or ""
  to: string;
}

export const EMPTY_PICKER_FILTERS: PickerFilters = {
  q: "",
  tour: "",
  surface: "",
  country: "",
  from: "",
  to: "",
};

export function filterPickerTournaments(
  tournaments: PickerTournament[],
  f: PickerFilters,
): PickerTournament[] {
  const q = f.q.trim().toLowerCase();
  const from = f.from ? new Date(f.from) : null;
  const to = f.to ? new Date(f.to) : null;

  return tournaments.filter((t) => {
    if (f.tour && t.tour !== f.tour) return false;
    if (f.surface && t.surface !== f.surface) return false;
    if (f.country && t.country !== f.country) return false;
    if (from && t.startDate < from) return false;
    if (to && t.startDate > to) return false;
    if (q) {
      const hay = `${t.name} ${t.city} ${t.country}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// Distinct filter options present in the list (so dropdowns never offer a
// value that matches nothing).
export function pickerOptions(tournaments: PickerTournament[]): {
  tours: string[];
  surfaces: string[];
  countries: string[];
} {
  const uniqSorted = (values: string[]) => [...new Set(values)].sort();
  return {
    tours: uniqSorted(tournaments.map((t) => t.tour)),
    surfaces: uniqSorted(tournaments.map((t) => t.surface)),
    countries: uniqSorted(tournaments.map((t) => t.country)),
  };
}
