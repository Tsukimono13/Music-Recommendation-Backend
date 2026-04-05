import { describe, it, expect } from "vitest";
import {
  normalizeArtistName,
  normalizeTag,
  isSensibleArtistName,
  normalizeArtistDisplayName,
} from "./normalize";

describe("normalizeArtistName", () => {
  it("lowercases and trims", () => {
    expect(normalizeArtistName("  Metallica  ")).toBe("metallica");
  });

  it("keeps unicode letters", () => {
    expect(normalizeArtistName("Ария")).toBe("ария");
  });

  it("normalizes quotes", () => {
    expect(normalizeArtistName("Guns N' Roses")).toBe("guns n' roses");
  });

  it("strips diacritics for dedup key", () => {
    expect(normalizeArtistName("Björk")).toBe("bjork");
  });
});

describe("normalizeTag", () => {
  it("lowercases and strips special chars", () => {
    expect(normalizeTag("Heavy Metal!")).toBe("heavy metal");
  });
});

describe("isSensibleArtistName", () => {
  it("rejects short names", () => {
    expect(isSensibleArtistName("ab")).toBe(false);
  });

  it("rejects garbage names", () => {
    expect(isSensibleArtistName("-")).toBe(false);
    expect(isSensibleArtistName("various artists")).toBe(false);
    expect(isSensibleArtistName("unknown")).toBe(false);
  });

  it("rejects digit-only names", () => {
    expect(isSensibleArtistName("123")).toBe(false);
    expect(isSensibleArtistName("-2")).toBe(false);
  });

  it("accepts valid names", () => {
    expect(isSensibleArtistName("Metallica")).toBe(true);
    expect(isSensibleArtistName("Ария")).toBe(true);
  });
});

describe("normalizeArtistDisplayName", () => {
  it("normalizes 'and the' to '& the'", () => {
    expect(normalizeArtistDisplayName("Tom Petty And The Heartbreakers"))
      .toBe("Tom Petty & the Heartbreakers");
  });

  it("collapses double spaces before 'the'", () => {
    expect(normalizeArtistDisplayName("Marilyn Manson  The Spooky Kids"))
      .toBe("Marilyn Manson & the Spooky Kids");
  });
});
