import { MusicSignal } from "../models/music-signal.model";
import { expandTagsToArtistSignals } from "./tag-expand.service";
import { normalizeArtistName } from "../utils/normalize";
import { RecommendMode } from "../types";

export async function buildRecommendations(
  signals: MusicSignal[],
  apiKey: string,
) {
  const tagSignals: MusicSignal[] = [];
  const artistSignals: MusicSignal[] = [];

  for (const signal of signals) {
    if (signal.kind === "tag") {
      tagSignals.push(signal);
    } else {
      artistSignals.push(signal);
    }
  }

  const expandedArtists = await expandTagsToArtistSignals(tagSignals, apiKey);

  const allArtists = [...artistSignals, ...expandedArtists];

  const scoreMap = new Map<string, number>();

  for (const s of allArtists) {
    const key = normalizeArtistName(s.value);
    scoreMap.set(key, (scoreMap.get(key) ?? 0) + s.weight);
  }

  return [...scoreMap.entries()]
    .map(([artist, score]) => ({ artist, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}
