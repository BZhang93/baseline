import { describe, it, expect } from "vitest";
import {
  filterPickerTournaments,
  pickerOptions,
  EMPTY_PICKER_FILTERS,
  type PickerFilters,
} from "./picker-filter";
import type { PickerTournament } from "./schedules";
import { Tour, Surface } from "@/generated/prisma/client";

function t(
  id: string,
  tour: Tour,
  surface: Surface,
  country: string,
  city: string,
  startDate: string,
): PickerTournament {
  return {
    id,
    name: `${city} Open`,
    tour,
    tier: "ATP_250",
    surface,
    city,
    country,
    startDate: new Date(startDate),
    endDate: new Date(startDate),
  };
}

const data: PickerTournament[] = [
  t("1", Tour.ATP, Surface.CLAY, "Germany", "Hamburg", "2026-07-13"),
  t("2", Tour.WTA, Surface.HARD, "United States", "Washington", "2026-07-27"),
  t("3", Tour.ATP, Surface.GRASS, "United States", "Newport", "2026-07-13"),
];

function f(overrides: Partial<PickerFilters>): PickerFilters {
  return { ...EMPTY_PICKER_FILTERS, ...overrides };
}

describe("filterPickerTournaments", () => {
  it("returns everything with empty filters", () => {
    expect(filterPickerTournaments(data, EMPTY_PICKER_FILTERS)).toHaveLength(3);
  });

  it("filters by tour and surface", () => {
    expect(filterPickerTournaments(data, f({ tour: Tour.ATP })).map((x) => x.id)).toEqual(["1", "3"]);
    expect(filterPickerTournaments(data, f({ surface: Surface.HARD })).map((x) => x.id)).toEqual(["2"]);
  });

  it("filters by country and date range", () => {
    expect(
      filterPickerTournaments(data, f({ country: "United States" })).map((x) => x.id),
    ).toEqual(["2", "3"]);
    expect(
      filterPickerTournaments(data, f({ from: "2026-07-20" })).map((x) => x.id),
    ).toEqual(["2"]);
  });

  it("searches name/city/country case-insensitively", () => {
    expect(filterPickerTournaments(data, f({ q: "hamburg" })).map((x) => x.id)).toEqual(["1"]);
    expect(filterPickerTournaments(data, f({ q: "united states" })).map((x) => x.id)).toEqual(["2", "3"]);
  });
});

describe("pickerOptions", () => {
  it("returns sorted distinct tours/surfaces/countries", () => {
    const opts = pickerOptions(data);
    expect(opts.tours).toEqual(["ATP", "WTA"]);
    expect(opts.surfaces).toEqual(["CLAY", "GRASS", "HARD"]);
    expect(opts.countries).toEqual(["Germany", "United States"]);
  });
});
