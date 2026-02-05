import { MusicSignal } from "../models/music-signal.model";
import { normalizeArtistName } from "../utils/normalize";

export function intersectArtistSignals(artistSignals: MusicSignal[][]) {
  const counts = new Map<string, number>();
  const scores = new Map<string, number>();

  for (const signals of artistSignals) {
    const seen = new Set<string>();

    for (const s of signals) {
      if (s.kind !== "artist") continue;

      const key = normalizeArtistName(s.value);
      if (seen.has(key)) continue;

      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      scores.set(key, (scores.get(key) ?? 0) + s.weight);
    }
  }

  const required = artistSignals.length;

  return [...scores.entries()]
    .filter(([artist]) => counts.get(artist)! >= required)
    .map(([artist, score]) => ({ artist, score }))
    .sort((a, b) => b.score - a.score);
}
