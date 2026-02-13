import { MusicSignal } from "../models/music-signal.model";
import { getTopArtistsByTag } from "../providers/lastfm.provider";
import { normalizeArtistName } from "../utils/normalize";

export interface TagExpandResult {
  signals: MusicSignal[];
  notFoundTags: string[];
}

export async function expandTagsToArtistSignals(
  tagSignals: MusicSignal[],
  apiKey: string,
): Promise<TagExpandResult> {
  const tagMap = new Map<string, number>();
  for (const tag of tagSignals) {
    const existing = tagMap.get(tag.value) ?? 0;
    tagMap.set(tag.value, Math.max(existing, tag.weight));
  }

  const notFoundTags: string[] = [];

  const expandedResults = await Promise.all(
    Array.from(tagMap.entries()).map(async ([tagValue, tagWeight]) => {
      const artists = await getTopArtistsByTag(tagValue, apiKey);
      
      if (artists.length === 0) {
        notFoundTags.push(tagValue);
        return [];
      }

      return artists.map((a) => ({
        kind: "artist" as const,
        source: "lastfm" as const,
        value: a.name,
        weight: tagWeight * (1 / a.rank),
      }));
    }),
  );

  return {
    signals: expandedResults.flat(),
    notFoundTags,
  };
}
