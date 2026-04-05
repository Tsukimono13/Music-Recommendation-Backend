import { describe, it, expect } from "vitest";
import { intersectArtistSignals } from "./intersection.service";
import type { MusicSignal } from "../models/music-signal.model";

function signal(name: string, weight = 1): MusicSignal {
  return { kind: "artist", source: "lastfm", value: name, weight };
}

describe("intersectArtistSignals", () => {
  it("returns artists present in all input lists", () => {
    const listA = [signal("Iron Maiden", 0.8), signal("Judas Priest", 0.6)];
    const listB = [signal("Iron Maiden", 0.7), signal("Megadeth", 0.9)];

    const result = intersectArtistSignals([listA, listB]);
    expect(result).toHaveLength(1);
    expect(result[0].artist).toBe("iron maiden");
  });

  it("returns empty when no overlap", () => {
    const listA = [signal("Metallica")];
    const listB = [signal("Bach")];
    expect(intersectArtistSignals([listA, listB])).toHaveLength(0);
  });

  it("sums weights across lists", () => {
    const listA = [signal("Slayer", 0.5)];
    const listB = [signal("Slayer", 0.3)];
    const result = intersectArtistSignals([listA, listB]);
    expect(result[0].score).toBeCloseTo(0.8);
  });

  it("filters garbage names", () => {
    const listA = [signal("-", 1)];
    const listB = [signal("-", 1)];
    expect(intersectArtistSignals([listA, listB])).toHaveLength(0);
  });
});
