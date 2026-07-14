import { describe, it, expect } from "vitest";
import { isNavActive } from "./nav";

describe("isNavActive", () => {
  it("is active for an exact match", () => {
    expect(isNavActive("/schedules", "/schedules")).toBe(true);
  });

  it("is active for a nested path", () => {
    expect(isNavActive("/schedules/new", "/schedules")).toBe(true);
    expect(isNavActive("/schedules/abc123", "/schedules")).toBe(true);
  });

  it("is not active for a different section", () => {
    expect(isNavActive("/browse", "/schedules")).toBe(false);
  });

  it("does not treat a prefix substring as nested", () => {
    // "/schedules-archive" should not activate "/schedules"
    expect(isNavActive("/schedules-archive", "/schedules")).toBe(false);
  });
});
