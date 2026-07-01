import { describe, it, expect } from "vitest";
import { healthStatus } from "./health";

describe("healthStatus", () => {
  it("reports ok when the database is reachable", () => {
    expect(healthStatus(true)).toEqual({ status: "ok", db: "up" });
  });

  it("reports degraded when the database is unreachable", () => {
    expect(healthStatus(false)).toEqual({ status: "degraded", db: "down" });
  });
});
