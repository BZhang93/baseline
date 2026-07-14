import { describe, it, expect } from "vitest";
import {
  toursForCircuit,
  rankingTourForCircuit,
  circuitForRankingTour,
  resolveBrowseTours,
} from "./circuit";
import { Circuit, Tour } from "@/generated/prisma/enums";

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

  it("does not auto-default once the user has chosen a tour this visit", () => {
    // "All tours" explicitly picked: tourExplicit=true, selectedTour=undefined.
    const r = resolveBrowseTours({
      circuit: Circuit.MENS,
      playerTours: [Tour.ATP, Tour.CHALLENGER],
      selectedTour: undefined,
      tourExplicit: true,
    });
    expect(r.tour).toBeUndefined();
    expect(r.tours).toEqual([Tour.ATP, Tour.CHALLENGER]);
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
