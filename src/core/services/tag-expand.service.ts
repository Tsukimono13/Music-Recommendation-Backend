import { MusicSignal } from "../models/music-signal.model";
import { getTopArtistsByTag } from "../providers/lastfm.provider";

export interface TagExpandResult {
  signals: MusicSignal[];
  notFoundTags: string[];
}

const DECADE_WORDS = new Set(["70s", "80s", "90s", "2000s", "2010s"]);
const MIN_ARTISTS_BEFORE_FALLBACK = 5;
const FALLBACK_LIMIT = 50;

function isEraGenreCompoundTag(tag: string): boolean {
  const parts = tag.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const hasDecade = parts.some((p) => DECADE_WORDS.has(p));
  return hasDecade;
}

function splitEraGenreTag(tag: string): [string, string] | null {
  const parts = tag.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const decadeIdx = parts.findIndex((p) => DECADE_WORDS.has(p.toLowerCase()));
  if (decadeIdx < 0) return null;
  const era = parts[decadeIdx];
  const genre = parts.slice(0, decadeIdx).concat(parts.slice(decadeIdx + 1)).join(" ");
  if (!genre) return null;
  return [era, genre];
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
      let artists = await getTopArtistsByTag(tagValue, apiKey);

      if (artists.length < MIN_ARTISTS_BEFORE_FALLBACK && isEraGenreCompoundTag(tagValue)) {
        const split = splitEraGenreTag(tagValue);
        if (split) {
          const [era, genre] = split;
          const [eraArtists, genreArtists] = await Promise.all([
            getTopArtistsByTag(era, apiKey, FALLBACK_LIMIT),
            getTopArtistsByTag(genre, apiKey, FALLBACK_LIMIT),
          ]);
          if (eraArtists.length > 0 && genreArtists.length > 0) {
            // Пересекаем: только артисты, присутствующие в обоих списках
            const genreSet = new Map<string, { name: string; rank: number }>();
            for (const a of genreArtists) {
              genreSet.set(a.name.toLowerCase(), a);
            }

            const signals: MusicSignal[] = [];
            for (const a of eraArtists) {
              const genreMatch = genreSet.get(a.name.toLowerCase());
              if (genreMatch) {
                // Артист есть в обоих списках — берём, вес = среднее из двух рангов
                const combinedWeight = tagWeight * (1 / a.rank + 1 / genreMatch.rank) / 2;
                signals.push({
                  kind: "artist",
                  source: "lastfm",
                  value: a.name,
                  weight: combinedWeight,
                });
              }
            }

            if (signals.length > 0) {
              return signals;
            }
            // Если пересечение пустое — fallback на union (лучше что-то, чем ничего)
          }

          if (eraArtists.length > 0 || genreArtists.length > 0) {
            const signals: MusicSignal[] = [];
            for (const a of [...eraArtists, ...genreArtists]) {
              signals.push({
                kind: "artist",
                source: "lastfm",
                value: a.name,
                weight: tagWeight * (1 / a.rank),
              });
            }
            return signals;
          }
        }
      }

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
