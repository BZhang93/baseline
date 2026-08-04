import { describe, it, expect } from "vitest";
import { forecastEvent } from "./forecast";

const POINTS = { W: 250, F: 165, SF: 100, QF: 50, R16: 25, R32: 13 };
const PRIZE = { W: 120000, F: 65000, SF: 37000, QF: 21000, R16: 12000, R32: 7000 };

describe("forecastEvent", () => {
  it("builds a geometric reach curve at 0.5 per match", () => {
    const f = forecastEvent({
      playerRank: null,
      fieldRefRank: null,
      pointsByRound: POINTS,
      prizeMoneyByRound: PRIZE,
    });
    expect(f.winProb).toBeCloseTo(0.5);
    // keys R32,R16,QF,SF,F,W → reach = 0.5^0..0.5^5
    expect(f.reachProb.R32).toBeCloseTo(1);
    expect(f.reachProb.R16).toBeCloseTo(0.5);
    expect(f.reachProb.QF).toBeCloseTo(0.25);
    expect(f.reachProb.W).toBeCloseTo(0.03125);
    expect(f.titleProb).toBeCloseTo(0.03125);
    expect(f.deepRunProb).toBeCloseTo(0.125); // P(reach SF)
    expect(f.basis).toBe("rank");
  });

  it("shifts advancement toward later rounds for a stronger player", () => {
    const strong = forecastEvent({ playerRank: 20, fieldRefRank: 100, pointsByRound: POINTS, prizeMoneyByRound: PRIZE });
    const weak = forecastEvent({ playerRank: 300, fieldRefRank: 100, pointsByRound: POINTS, prizeMoneyByRound: PRIZE });
    expect(strong.deepRunProb).toBeGreaterThan(weak.deepRunProb);
    expect(strong.titleProb).toBeGreaterThan(weak.titleProb);
    expect(strong.expectedPoints).toBeGreaterThan(weak.expectedPoints);
  });

  it("handles an empty points table", () => {
    const f = forecastEvent({ playerRank: 50, fieldRefRank: 100, pointsByRound: {}, prizeMoneyByRound: {} });
    expect(f.reachProb).toEqual({});
    expect(f.titleProb).toBe(0);
    expect(f.deepRunProb).toBe(0);
    expect(f.expectedPoints).toBe(0);
  });
});
