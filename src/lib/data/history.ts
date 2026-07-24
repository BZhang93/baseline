// Historical draw → prior-edition cutoff derivation (BRA-106).
//
// Pure parsing + derivation, independent of where the data comes from. Input is
// a match-level CSV in the widely-used "Sackmann format" (one row per match,
// with each player's rank at the time and an entry code). The cutoff for an
// event = the lowest-ranked DIRECT acceptance in the main draw — i.e. the last
// player who got in on ranking, excluding qualifiers/wildcards/lucky losers.
//
// The network fetch lives in the ingest script (scripts run where there's
// internet); this module is the testable core and has no I/O. The source is
// swappable: any feed that can emit these columns works.

export interface HistMatchRow {
  tourneyId: string;
  tourneyName: string;
  level: string; // tourney_level (G/M/A/C/… ATP, P/… WTA)
  date: string; // tourney_date, YYYYMMDD
  surface: string;
  drawSize: number | null;
  round: string;
  winnerName: string;
  winnerEntry: string; // "" = direct acceptance; Q/WC/LL/SE/PR/ALT = special
  winnerRank: number | null;
  loserName: string;
  loserEntry: string;
  loserRank: number | null;
}

// A direct acceptance carries no entry code. Any code (Q, WC, LL, SE, PR, ALT,
// JE, …) means the player got in some other way and doesn't set the cutoff.
export function isDirectAcceptance(entry: string): boolean {
  return (entry ?? "").trim() === "";
}

// Parse a single CSV line, honoring double-quoted fields (with "" escapes).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else if (c === '"') {
      inQuotes = true;
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function toNum(s: string | undefined): number | null {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Parse a match CSV into rows, keyed by header names (tolerant of column order
// and extra columns). Rows missing the essential columns are skipped.
export function parseMatchesCsv(csv: string): HistMatchRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const at = (name: string) => header.indexOf(name);
  const c = {
    tourneyId: at("tourney_id"),
    tourneyName: at("tourney_name"),
    level: at("tourney_level"),
    date: at("tourney_date"),
    surface: at("surface"),
    drawSize: at("draw_size"),
    round: at("round"),
    wName: at("winner_name"),
    wEntry: at("winner_entry"),
    wRank: at("winner_rank"),
    lName: at("loser_name"),
    lEntry: at("loser_entry"),
    lRank: at("loser_rank"),
  };
  const get = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "") : "");

  const rows: HistMatchRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const tourneyId = get(cells, c.tourneyId);
    const winnerName = get(cells, c.wName);
    const loserName = get(cells, c.lName);
    if (!tourneyId || (!winnerName && !loserName)) continue;
    rows.push({
      tourneyId,
      tourneyName: get(cells, c.tourneyName),
      level: get(cells, c.level),
      date: get(cells, c.date),
      surface: get(cells, c.surface),
      drawSize: toNum(get(cells, c.drawSize)),
      round: get(cells, c.round),
      winnerName,
      winnerEntry: get(cells, c.wEntry),
      winnerRank: toNum(get(cells, c.wRank)),
      loserName,
      loserEntry: get(cells, c.lEntry),
      loserRank: toNum(get(cells, c.lRank)),
    });
  }
  return rows;
}

export interface EventCutoff {
  tourneyId: string;
  tourneyName: string;
  level: string;
  date: string;
  surface: string;
  drawSize: number | null;
  // Lowest-ranked direct acceptance = the real cutoff; null if no ranked
  // direct entrant could be identified.
  cutoffRank: number | null;
  directCount: number; // ranked direct acceptances counted
  fieldSize: number; // distinct players seen in the main draw
}

// Collapse match rows into one cutoff per event (tourney_id). Reconstructs the
// main-draw field from every winner + loser, then takes the max (lowest) rank
// among direct acceptances.
export function deriveEventCutoffs(rows: HistMatchRow[]): EventCutoff[] {
  const groups = new Map<string, HistMatchRow[]>();
  for (const r of rows) {
    const g = groups.get(r.tourneyId);
    if (g) g.push(r);
    else groups.set(r.tourneyId, [r]);
  }

  const out: EventCutoff[] = [];
  for (const grp of groups.values()) {
    // First appearance of each player carries their entry + rank for the event.
    const players = new Map<string, { entry: string; rank: number | null }>();
    for (const r of grp) {
      if (r.winnerName && !players.has(r.winnerName)) {
        players.set(r.winnerName, { entry: r.winnerEntry, rank: r.winnerRank });
      }
      if (r.loserName && !players.has(r.loserName)) {
        players.set(r.loserName, { entry: r.loserEntry, rank: r.loserRank });
      }
    }
    const directRanks: number[] = [];
    for (const p of players.values()) {
      if (isDirectAcceptance(p.entry) && p.rank != null) directRanks.push(p.rank);
    }
    const first = grp[0];
    out.push({
      tourneyId: first.tourneyId,
      tourneyName: first.tourneyName,
      level: first.level,
      date: first.date,
      surface: first.surface,
      drawSize: first.drawSize,
      cutoffRank: directRanks.length ? Math.max(...directRanks) : null,
      directCount: directRanks.length,
      fieldSize: players.size,
    });
  }
  return out;
}

// Normalize an event name for fuzzy matching across sponsor renames.
export function normalizeEventName(name: string): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Match derived historical events to our current events by city (a stable token
// that survives sponsor renames). Returns current-event-key → cutoffRank.
// Pass events for a SINGLE tour/circuit — a city can host both an ATP and a WTA
// event (e.g. Washington), and city alone can't tell them apart.
export function matchCutoffsByCity(
  cutoffs: EventCutoff[],
  events: { key: string; city: string }[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const e of events) {
    const city = normalizeEventName(e.city);
    if (!city) continue;
    const hit = cutoffs.find(
      (c) => c.cutoffRank != null && normalizeEventName(c.tourneyName).includes(city),
    );
    if (hit) result.set(e.key, hit.cutoffRank!);
  }
  return result;
}
