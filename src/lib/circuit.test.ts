import { describe, it, expect } from "vitest";
import {
  toursForCircuit,
  rankingTourForCircuit,
  circuitForRankingTour,
  circuitForTournament,
  resolveBrowseTours,
} from "./circuit";
import { Circuit, Tour } from "@/generated/prisma/enums";

describe("circuitForTournament", () => {
  it("maps tour-based circuits", () => {
    expect(circuitForTournament(Tour.ATP, "ATP_250")).toBe(Circuit.MENS);
    expect(circuitForTournament(Tour.CHALLENGER, "CHALLENGER_125")).toBe(Circuit.MENS);
    expect(circuitForTournament(Tour.WTA, "WTA_500")).toBe(Circuit.WOMENS);
  });
  it("reads ITF gender from the tier", () => {
    expect(circuitForTournament(Tour.ITF, "ITF_M25")).toBe(Circuit.MENS);
    expect(circuitForTournament(Tour.ITF, "ITF_W25")).toBe(Circuit.WOMENS);
    expect(circuitForTournament(Tour.ITF, "ITF_W15")).toBe(Circuit.WOMENS);
  });
});

describe("toursForCircuit", () => {
  it("men's → ATP, Challenger, ITF", () => {
    expect(toursForCircuit(Circuit.MENS)).toEqual([Tour.ATP, Tour.CHALLENGER, Tour.ITF]);
  });
  it("women's → WTA, ITF", () => {
    expect(toursForCircuit(Circuit.WOMENS)).toEqual([Tour.WTA, Tour.ITF]);
  });
});

describe("rankingTourForCircuit", () => {
  it("maps men's → ATP, women's → WTA", () => {
    expect(rankingTourForCircuit(Circuit.MENS)).toBe(Tour.ATP);
    expect(rankingTourForCircuit(Circuit.WOMENS)).toBe(Tour.WTA);
  });
});

describe("circuitForRankingTour", () => {
  it("back-derives the circuit from a ranking tour", () => {
    expect(circuitForRankingTour(Tour.ATP)).toBe(Circuit.MENS);
    expect(circuitForRankingTour(Tour.WTA)).toBe(Circuit.WOMENS);
    expect(circuitForRankingTour(Tour.ITF)).toBeNull();
    expect(circuitForRankingTour(null)).toBeNull();
  });
});

describe("resolveBrowseTours", () => {
  it("dropdown options follow the circuit", () => {
    expect(
      resolveBrowseTours({
        circuit: Circuit.MENS,
        playerTours: [],
        selectedTour: undefined,
        tourExplicit: false,
      }).options,
    ).toEqual([Tour.ATP, Tour.CHALLENGER, Tour.ITF]);
    expect(
      resolveBrowseTours({
        circuit: Circuit.WOMENS,
        playerTours: [],
        selectedTour: undefined,
        tourExplicit: false,
      }).options,
    ).toEqual([Tour.WTA, Tour.ITF]);
  });

  it("defaults to the player's tour when they compete on exactly one", () => {
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [Tour.ITF],
      selectedTour: undefined,
      tourExplicit: false,
    });
    expect(r.tour).toBe(Tour.ITF);
    expect(r.tours).toBeUndefined();
  });

  it("scopes All tours to the player's selected tours when they play several", () => {
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [Tour.ATP, Tour.CHALLENGER],
      selectedTour: undefined,
      tourExplicit: false,
    });
    expect(r.tour).toBeUndefined();
    // ITF is on the circuit but the player didn't pick it — excluded.
    expect(r.tours).toEqual([Tour.ATP, Tour.CHALLENGER]);
  });

  it("scopes All tours to the whole circuit only when the player picked no tours", () => {
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [],
      selectedTour: undefined,
      tourExplicit: false,
    });
    expect(r.tour).toBeUndefined();
    expect(r.tours).toEqual([Tour.ATP, Tour.CHALLENGER, Tour.ITF]);
  });

  it("explicit All tours widens to the whole circuit (escape hatch)", () => {
    // A Challenger-only player picks "All tours" — they should see every
    // men's event, not just Challenger.
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [Tour.CHALLENGER],
      selectedTour: undefined,
      tourExplicit: true,
    });
    expect(r.tour).toBeUndefined();
    expect(r.tours).toEqual([Tour.ATP, Tour.CHALLENGER, Tour.ITF]);
  });

  it("explicit All tours ignores the saved subset for multi-tour players too", () => {
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [Tour.ATP, Tour.CHALLENGER],
      selectedTour: undefined,
      tourExplicit: true,
    });
    expect(r.tour).toBeUndefined();
    expect(r.tours).toEqual([Tour.ATP, Tour.CHALLENGER, Tour.ITF]);
  });

  it("honors an explicit in-circuit selection", () => {
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [Tour.ITF],
      selectedTour: Tour.ATP,
      tourExplicit: true,
    });
    expect(r.tour).toBe(Tour.ATP);
    expect(r.tours).toBeUndefined();
  });

  it("drops an out-of-circuit selection", () => {
    const r = resolveBrowseTours({
      circuit: Circuit.WOMENS,
      playerTours: [],
      selectedTour: Tour.ATP, // not on the women's circuit
      tourExplicit: true,
    });
    expect(r.tour).toBeUndefined();
    expect(r.tours).toEqual([Tour.WTA, Tour.ITF]);
  });

  it("no circuit: all tours listed, no scoping (logged-out / unset)", () => {
    const r = resolveBrowseTours({
      circuit: null,
      playerTours: [],
      selectedTour: Tour.WTA,
      tourExplicit: true,
    });
    expect(r.options).toEqual(Object.values(Tour));
    expect(r.tour).toBe(Tour.WTA);
    expect(r.tours).toBeUndefined();
  });
});
