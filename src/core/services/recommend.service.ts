import { MusicSignal } from "../models/music-signal.model";
import { expandTagsToArtistSignals } from "./tag-expand.service";
import { normalizeArtistName, isSensibleArtistName } from "../utils/normalize";

export interface BuildRecommendationsResult {
  artists: { artist: string; score: number }[];
  notFoundTags: string[];
}

export async function buildRecommendations(
  signals: MusicSignal[],
  apiKey: string,
): Promise<BuildRecommendationsResult> {
  const tagSignals: MusicSignal[] = [];
  const artistSignals: MusicSignal[] = [];

  for (const signal of signals) {
    if (signal.kind === "tag") {
      tagSignals.push(signal);
    } else {
      artistSignals.push(signal);
    }
  }

  const { signals: expandedArtists, notFoundTags } = await expandTagsToArtistSignals(tagSignals, apiKey);

  const allArtists = [...artistSignals, ...expandedArtists];

  const scoreMap = new Map<string, number>();

  for (const s of allArtists) {
    const key = normalizeArtistName(s.value);
    scoreMap.set(key, (scoreMap.get(key) ?? 0) + s.weight);
  }

  const limit = Math.min(100, Math.max(10, Number(process.env.RECOMMEND_ARTISTS_LIMIT) || 30));
  const artists = [...scoreMap.entries()]
    .filter(([artist]) => isSensibleArtistName(artist))
    .map(([artist, score]) => ({ artist, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    artists,
    notFoundTags,
  };
}
