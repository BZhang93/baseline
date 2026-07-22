// The validate→promote gate (BRA-36). Given a DataSource's fetched output, run
// sanity + ground-truth checks and return a report. The ingest step promotes to
// the live tables ONLY when there are no errors, so a bad scrape can never
// corrupt what players see. Pure and dependency-light so it's unit-testable.

import type { LoadedData, RoundValues } from "./types";

export interface ValidationIssue {
  level: "error" | "warning";
  entity: string; // e.g. "category ATP:ATP_250:2026" or "tournament Iasi Challenger"
  message: string;
}

export interface ValidationReport {
  ok: boolean; // true when there are no errors (warnings don't block promotion)
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  counts: { categories: number; tournaments: number; rankings: number };
}

export interface ValidateOptions {
  // Every event's edition (and its dates) must be this season. Default 2026.
  expectedSeason?: number;
  // If set, event start dates must fall in these 1-based months (e.g. [7] for
  // July). Omit to allow any month in the season.
  expectedMonths?: number[];
  // Acceptable main-draw sizes (inclusive range). Defaults to [4, 256].
  drawSizeRange?: [number, number];
}

// Main-draw rounds from most to least advanced. Points and prize must not
// increase as you go deeper (a QF can't out-pay a SF).
const ROUND_ORDER = ["W", "F", "SF", "QF", "R16", "R32", "R64", "R128"];
// "Typical" main-draw sizes; anything else is flagged as a warning, not an error.
const TYPICAL_DRAWS = new Set([16, 28, 32, 48, 56, 64, 96, 128]);

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// Checks a round-keyed map is present, non-empty, all values finite & >= 0, has
// a winner ("W") entry, and is non-increasing along ROUND_ORDER.
function checkRoundValues(
  values: RoundValues,
  label: string,
  entity: string,
  errors: ValidationIssue[],
): void {
  // Untrusted input: a malformed source could hand us a non-object here, so
  // guard before using `in` (which throws on primitives).
  if (values == null || typeof values !== "object") {
    errors.push({ level: "error", entity, message: `${label} is not an object` });
    return;
  }
  const keys = Object.keys(values);
  if (keys.length === 0) {
    errors.push({ level: "error", entity, message: `${label} is empty` });
    return;
  }
  if (!("W" in values)) {
    errors.push({ level: "error", entity, message: `${label} has no winner ("W") value` });
  }
  for (const [round, v] of Object.entries(values)) {
    if (!isFiniteNumber(v) || v < 0) {
      errors.push({
        level: "error",
        entity,
        message: `${label}.${round} is not a non-negative number (${String(v)})`,
      });
    }
  }
  // Monotonic non-increasing across the known rounds that are present.
  const present = ROUND_ORDER.filter((r) => isFiniteNumber(values[r]));
  for (let i = 1; i < present.length; i++) {
    if (values[present[i]] > values[present[i - 1]]) {
      errors.push({
        level: "error",
        entity,
        message: `${label} not monotonic: ${present[i]} (${values[present[i]]}) > ${present[i - 1]} (${values[present[i - 1]]})`,
      });
    }
  }
}

export function validateLoadedData(
  data: LoadedData,
  opts: ValidateOptions = {},
): ValidationReport {
  const season = opts.expectedSeason ?? 2026;
  const [drawMin, drawMax] = opts.drawSizeRange ?? [4, 256];
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // --- Categories: the points/prize ground truth ---------------------------
  const categoryKeys = new Set<string>();
  for (const c of data.categories) {
    const entity = `category ${c.tour}:${c.tier}:${c.season}`;
    const key = `${c.tour}:${c.tier}:${c.season}`;
    if (categoryKeys.has(key)) {
      errors.push({ level: "error", entity, message: "duplicate category (tour, tier, season)" });
    }
    categoryKeys.add(key);
    if (!c.tour || !c.tier) {
      errors.push({ level: "error", entity, message: "missing tour or tier" });
    }
    checkRoundValues(c.pointsByRound, "pointsByRound", entity, errors);
    checkRoundValues(c.prizeMoneyByRound, "prizeMoneyByRound", entity, errors);
  }

  // --- Tournaments: sanity + must reconcile to a category ------------------
  for (const t of data.tournaments) {
    const entity = `tournament ${t.name}`;
    const required: [string, unknown][] = [
      ["name", t.name],
      ["tour", t.tour],
      ["tier", t.tier],
      ["city", t.city],
      ["country", t.country],
      ["surface", t.surface],
      ["startDate", t.startDate],
      ["endDate", t.endDate],
      ["drawSize", t.drawSize],
    ];
    for (const [field, value] of required) {
      if (value == null || value === "") {
        errors.push({ level: "error", entity, message: `missing required field "${field}"` });
      }
    }

    if (t.startDate && t.endDate && t.endDate.getTime() < t.startDate.getTime()) {
      errors.push({ level: "error", entity, message: "endDate is before startDate" });
    }
    if (t.edition !== season) {
      errors.push({
        level: "error",
        entity,
        message: `edition ${t.edition} != expected season ${season}`,
      });
    }
    if (t.startDate) {
      if (t.startDate.getUTCFullYear() !== season) {
        errors.push({
          level: "error",
          entity,
          message: `startDate year ${t.startDate.getUTCFullYear()} != season ${season}`,
        });
      }
      if (opts.expectedMonths && !opts.expectedMonths.includes(t.startDate.getUTCMonth() + 1)) {
        errors.push({
          level: "error",
          entity,
          message: `startDate month ${t.startDate.getUTCMonth() + 1} not in expected ${opts.expectedMonths.join(",")}`,
        });
      }
    }

    if (isFiniteNumber(t.drawSize)) {
      if (t.drawSize < drawMin || t.drawSize > drawMax) {
        errors.push({
          level: "error",
          entity,
          message: `drawSize ${t.drawSize} out of range [${drawMin}, ${drawMax}]`,
        });
      } else if (!TYPICAL_DRAWS.has(t.drawSize)) {
        warnings.push({ level: "warning", entity, message: `unusual drawSize ${t.drawSize}` });
      }
    }

    // Reconcile to ground truth: every event must map to a category so its
    // points/prize come from a vetted table, not a blank or a guess.
    if (t.tour && t.tier) {
      const key = `${t.tour}:${t.tier}:${t.edition}`;
      if (!categoryKeys.has(key)) {
        errors.push({
          level: "error",
          entity,
          message: `no category ground truth for ${key}`,
        });
      }
    }

    // Cutoff sanity (optional block).
    const cut = t.cutoff;
    if (cut) {
      for (const [field, value] of Object.entries({
        liveCutoffRank: cut.liveCutoffRank,
        liveCutoffPoints: cut.liveCutoffPoints,
        historicalCutoffRank: cut.historicalCutoffRank,
        historicalCutoffPoints: cut.historicalCutoffPoints,
      })) {
        if (value != null && (!isFiniteNumber(value) || value < 0)) {
          errors.push({ level: "error", entity, message: `cutoff.${field} is negative/invalid` });
        }
      }
    }
  }

  // --- Rankings: contiguous-ish, monotonic points --------------------------
  const byList = new Map<string, { rank: number; points: number; name: string }[]>();
  for (const r of data.rankings) {
    const entity = `ranking ${r.tour} #${r.rank}`;
    if (!r.tour || !r.playerName || !isValidDate(r.asOfDate)) {
      errors.push({
        level: "error",
        entity,
        message: "missing/invalid tour, playerName, or asOfDate",
      });
      continue;
    }
    if (!Number.isInteger(r.rank) || r.rank < 1) {
      errors.push({ level: "error", entity, message: `rank ${r.rank} is not a positive integer` });
    }
    if (!isFiniteNumber(r.points) || r.points < 0) {
      errors.push({ level: "error", entity, message: `points ${r.points} is negative/invalid` });
    }
    const listKey = `${r.tour}:${r.asOfDate.toISOString().slice(0, 10)}`;
    if (!byList.has(listKey)) byList.set(listKey, []);
    byList.get(listKey)!.push({ rank: r.rank, points: r.points, name: r.playerName });
  }
  for (const [listKey, rows] of byList) {
    rows.sort((a, b) => a.rank - b.rank);
    const seen = new Set<number>();
    for (let i = 0; i < rows.length; i++) {
      if (seen.has(rows[i].rank)) {
        errors.push({ level: "error", entity: `rankings ${listKey}`, message: `duplicate rank ${rows[i].rank}` });
      }
      seen.add(rows[i].rank);
      // Points must not increase as rank number grows (a lower-ranked player
      // can tie but not out-point a higher-ranked one).
      if (i > 0 && rows[i].points > rows[i - 1].points) {
        errors.push({
          level: "error",
          entity: `rankings ${listKey}`,
          message: `points not monotonic: #${rows[i].rank} (${rows[i].points}) > #${rows[i - 1].rank} (${rows[i - 1].points})`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      categories: data.categories.length,
      tournaments: data.tournaments.length,
      rankings: data.rankings.length,
    },
  };
}

// A compact human-readable summary for logs / alerts.
export function formatValidationReport(report: ValidationReport): string {
  const { counts } = report;
  const head =
    `${report.ok ? "PASS" : "FAIL"} — ${counts.categories} categories, ` +
    `${counts.tournaments} tournaments, ${counts.rankings} rankings; ` +
    `${report.errors.length} error(s), ${report.warnings.length} warning(s)`;
  const lines = [
    ...report.errors.map((e) => `  ✗ [${e.entity}] ${e.message}`),
    ...report.warnings.map((w) => `  ! [${w.entity}] ${w.message}`),
  ];
  return [head, ...lines].join("\n");
}
