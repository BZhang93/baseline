import { describe, it, expect } from "vitest";
import {
  parseMatchesCsv,
  isDirectAcceptance,
  deriveEventCutoffs,
  matchCutoffsByCity,
  normalizeEventName,
} from "./history";

// A small match CSV in Sackmann format: two events, with a mix of direct
// acceptances (blank entry), a qualifier (Q) and a wildcard (WC).
const CSV = `tourney_id,tourney_name,tourney_level,tourney_date,surface,draw_size,round,winner_name,winner_entry,winner_rank,loser_name,loser_entry,loser_rank
2025-314,Swiss Open Gstaad,A,20250714,Clay,28,R32,Player A,,10,Player E,Q,200
2025-314,Swiss Open Gstaad,A,20250714,Clay,28,R32,Player B,,50,Player F,WC,300
2025-314,Swiss Open Gstaad,A,20250714,Clay,28,R16,Player A,,10,Player C,,95
2025-319,Plava Laguna Croatia Open Umag,A,20250714,Clay,28,R32,Player G,,30,Player H,,120
2025-319,Plava Laguna Croatia Open Umag,A,20250714,Clay,28,R32,Player I,LL,180,Player J,,80`;

describe("isDirectAcceptance", () => {
  it("is true only for a blank entry code", () => {
    expect(isDirectAcceptance("")).toBe(true);
    expect(isDirectAcceptance("  ")).toBe(true);
    expect(isDirectAcceptance("Q")).toBe(false);
    expect(isDirectAcceptance("WC")).toBe(false);
    expect(isDirectAcceptance("LL")).toBe(false);
  });
});

describe("parseMatchesCsv", () => {
  it("parses rows keyed by header, coercing ranks to numbers", () => {
    const rows = parseMatchesCsv(CSV);
    expect(rows).toHaveLength(5);
    expect(rows[0].winnerName).toBe("Player A");
    expect(rows[0].winnerRank).toBe(10);
    expect(rows[0].loserEntry).toBe("Q");
  });

  it("returns [] for empty input", () => {
    expect(parseMatchesCsv("")).toEqual([]);
    expect(parseMatchesCsv("tourney_id,winner_name\n")).toEqual([]);
  });
});

describe("deriveEventCutoffs", () => {
  const cutoffs = deriveEventCutoffs(parseMatchesCsv(CSV));

  it("takes the lowest-ranked DIRECT acceptance, excluding Q/WC/LL", () => {
    const gstaad = cutoffs.find((c) => c.tourneyId === "2025-314")!;
    // Directs are ranks 10, 50, 95; the Q(200) and WC(300) are excluded → 95.
    expect(gstaad.cutoffRank).toBe(95);
    expect(gstaad.directCount).toBe(3);
    expect(gstaad.fieldSize).toBe(5);

    const umag = cutoffs.find((c) => c.tourneyId === "2025-319")!;
    // Directs are 30, 120, 80; LL(180) excluded → 120.
    expect(umag.cutoffRank).toBe(120);
  });

  it("carries event metadata through", () => {
    const gstaad = cutoffs.find((c) => c.tourneyId === "2025-314")!;
    expect(gstaad.tourneyName).toBe("Swiss Open Gstaad");
    expect(gstaad.surface).toBe("Clay");
    expect(gstaad.drawSize).toBe(28);
  });

  it("yields a null cutoff when no ranked direct entrant exists", () => {
    const onlyQ = deriveEventCutoffs(
      parseMatchesCsv(
        `tourney_id,tourney_name,round,winner_name,winner_entry,winner_rank,loser_name,loser_entry,loser_rank
X,Test,F,W,Q,50,L,WC,60`,
      ),
    );
    expect(onlyQ[0].cutoffRank).toBeNull();
  });
});

describe("matchCutoffsByCity", () => {
  it("maps derived events to our events by city, surviving sponsor names", () => {
    const cutoffs = deriveEventCutoffs(parseMatchesCsv(CSV));
    const matched = matchCutoffsByCity(cutoffs, [
      { key: "Swiss Open Gstaad", city: "Gstaad" },
      { key: "Plava Laguna Croatia Open Umag", city: "Umag" },
      { key: "Nowhere Open", city: "Nowhere" },
    ]);
    expect(matched.get("Swiss Open Gstaad")).toBe(95);
    expect(matched.get("Plava Laguna Croatia Open Umag")).toBe(120);
    expect(matched.has("Nowhere Open")).toBe(false);
  });
});

describe("normalizeEventName", () => {
  it("strips punctuation/case for matching", () => {
    expect(normalizeEventName("Plava Laguna Croatia Open Umag")).toBe(
      "plavalagunacroatiaopenumag",
    );
  });
});
