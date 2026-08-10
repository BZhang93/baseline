import { describe, it, expect } from "vitest";
import { decideRate, type RateWindow } from "./rate-limit";

const WINDOW = 60 * 60 * 1000; // 1h
const LIMIT = 3;

describe("decideRate (review H4)", () => {
  it("opens a fresh window with no prior state", () => {
    const { next, decision } = decideRate(undefined, 1000, LIMIT, WINDOW);
    expect(decision.ok).toBe(true);
    expect(next).toEqual({ windowStartedAt: 1000, count: 1 });
  });

  it("increments within the window while under the limit", () => {
    const prev: RateWindow = { windowStartedAt: 1000, count: 1 };
    const { next, decision } = decideRate(prev, 1500, LIMIT, WINDOW);
    expect(decision.ok).toBe(true);
    expect(next.count).toBe(2);
    expect(next.windowStartedAt).toBe(1000);
  });

  it("blocks once the limit is reached and reports retry-after", () => {
    const prev: RateWindow = { windowStartedAt: 1000, count: LIMIT };
    const now = 1000 + WINDOW / 2;
    const { next, decision } = decideRate(prev, now, LIMIT, WINDOW);
    expect(decision.ok).toBe(false);
    expect(decision.retryAfterSeconds).toBe(Math.ceil((1000 + WINDOW - now) / 1000));
    expect(next).toBe(prev); // state unchanged when blocked
  });

  it("resets to a new window once the old one elapses", () => {
    const prev: RateWindow = { windowStartedAt: 1000, count: LIMIT };
    const { next, decision } = decideRate(prev, 1000 + WINDOW, LIMIT, WINDOW);
    expect(decision.ok).toBe(true);
    expect(next).toEqual({ windowStartedAt: 1000 + WINDOW, count: 1 });
  });
});
