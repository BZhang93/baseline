import { describe, it, expect } from "vitest";
import { isValidTourProfileUrl, tourProfileProvider } from "./tour-profile";

describe("tourProfileProvider", () => {
  it("labels the official tour domains (with or without www)", () => {
    expect(tourProfileProvider("https://www.atptour.com/en/players/a/b/overview")).toBe("ATP");
    expect(tourProfileProvider("https://wtatennis.com/players/123/name")).toBe("WTA");
    expect(tourProfileProvider("https://www.itftennis.com/en/players/name/123/")).toBe("ITF");
  });

  it("returns null for non-tour or malformed URLs", () => {
    expect(tourProfileProvider("https://example.com/me")).toBeNull();
    expect(tourProfileProvider("not a url")).toBeNull();
    expect(tourProfileProvider("ftp://atptour.com/x")).toBeNull();
    expect(tourProfileProvider("")).toBeNull();
  });

  it("is not fooled by lookalike hosts", () => {
    expect(tourProfileProvider("https://atptour.com.evil.test/x")).toBeNull();
    expect(tourProfileProvider("https://notatptour.com/x")).toBeNull();
  });
});

describe("isValidTourProfileUrl", () => {
  it("mirrors provider detection", () => {
    expect(isValidTourProfileUrl("https://www.atptour.com/en/players/x")).toBe(true);
    expect(isValidTourProfileUrl("https://example.com")).toBe(false);
  });
});
