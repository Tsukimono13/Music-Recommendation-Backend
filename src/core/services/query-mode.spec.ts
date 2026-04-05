import { describe, it, expect } from "vitest";
import { detectQueryMode } from "./query-mode.service";

describe("detectQueryMode", () => {
  it("returns 'single' for one artist, no tags", () => {
    expect(detectQueryMode({ artists: ["Metallica"] })).toBe("single");
  });

  it("returns 'intersection' for multiple artists, no tags", () => {
    expect(detectQueryMode({ artists: ["Metallica", "Slayer"] })).toBe("intersection");
  });

  it("returns 'by-tags' for tags only", () => {
    expect(detectQueryMode({ tags: ["rock", "metal"] })).toBe("by-tags");
  });

  it("returns 'artist+tags' for both", () => {
    expect(detectQueryMode({ artists: ["Metallica"], tags: ["metal"] })).toBe("artist+tags");
  });

  it("throws on empty input", () => {
    expect(() => detectQueryMode({})).toThrow("Invalid query");
  });
});
