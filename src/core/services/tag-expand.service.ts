import { MusicSignal } from "../models/music-signal.model";
import { getTopArtistsByTag } from "../providers/lastfm.provider";
import { normalizeArtistName } from "../utils/normalize";

export async function expandTagsToArtistSignals(
  tagSignals: MusicSignal[],
  apiKey: string,
): Promise<MusicSignal[]> {
  const tagMap = new Map<string, number>();
  for (const tag of tagSignals) {
    const existing = tagMap.get(tag.value) ?? 0;
    tagMap.set(tag.value, Math.max(existing, tag.weight));
  }

  const expandedResults = await Promise.all(
    Array.from(tagMap.entries()).map(async ([tagValue, tagWeight]) => {
      const artists = await getTopArtistsByTag(tagValue, apiKey);
      return artists.map((a) => ({
        kind: "artist" as const,
        source: "lastfm" as const,
        value: a.name,
        weight: tagWeight * (1 / a.rank),
      }));
    }),
  );

  // Flatten результатов
  return expandedResults.flat();
}
