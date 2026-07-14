import { describe, it, expect } from "vitest";
import {
  toursForCircuit,
  rankingTourForCircuit,
  circuitForRankingTour,
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
