import { QueryInput } from "../models/query-input.model";
import { detectQueryMode } from "./query-mode.service";
import { collectSignalsForArtist } from "./signals.service";
import { buildRecommendations } from "./recommend.service";
import { intersectArtistSignals } from "./intersection.service";
import { MusicSignal } from "../models/music-signal.model";
import { normalizeTag, normalizeArtistName } from "../utils/normalize";

export interface QueryResult {
  artists: { artist: string; score: number }[];
  tags?: string[];
  fallbackArtists?: { artist: string; score: number }[];
}

function normalizeToPercent(
  results: { artist: string; score: number }[],
): { artist: string; score: number }[] {
  if (results.length === 0) return [];

  const maxScore = results[0]?.score ?? 1;
  if (maxScore === 0) return results;

  return results.map((item) => ({
    artist: item.artist,
    score: Math.round((item.score / maxScore) * 100),
  }));
}

function extractUniqueTags(signals: MusicSignal[]): string[] {
  const tagSet = new Set<string>();

  for (const signal of signals) {
    if (signal.kind === "tag") {
      tagSet.add(normalizeTag(signal.value));
    }
  }

  if (tagSet.size === 0) return [];

  return Array.from(tagSet).sort();
}

export async function resolveQuery(
  input: QueryInput,
  apiKey: string,
): Promise<QueryResult> {
  const mode = detectQueryMode(input);

  switch (mode) {
    case "single": {
      const signals = await collectSignalsForArtist(input.artists![0], {
        lastfm: apiKey,
      });

      const artistSignals = signals.filter(
        (s) => s.kind === "artist" && s.source === "lastfm",
      );

      const result = await buildRecommendations(artistSignals, apiKey);
      const normalized = normalizeToPercent(result);

      const tags = extractUniqueTags(signals);

      return {
        artists: normalized,
        tags: tags.length > 0 ? tags : undefined,
      };
    }

    case "intersection": {
      const all = await Promise.all(
        input.artists!.map((a) =>
          collectSignalsForArtist(a, { lastfm: apiKey }),
        ),
      );

      const intersection = intersectArtistSignals(all);

      const allSignalsFlat = all.flat();
      const tags = extractUniqueTags(allSignalsFlat);

      // Если нет пересечений, возвращаем пустой artists и fallbackArtists
      if (intersection.length === 0) {
        const fallbackArtists: { artist: string; score: number }[] = [];
        const seen = new Set<string>();

        for (const signals of all) {
          const artistSignals = signals
            .filter((s) => s.kind === "artist" && s.source === "lastfm")
            .map((s) => ({
              artist: s.value,
              score: s.weight,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2);

          for (const item of artistSignals) {
            const key = normalizeArtistName(item.artist);
            if (!seen.has(key)) {
              seen.add(key);
              fallbackArtists.push(item);
            }
          }
        }

        const normalizedFallback = normalizeToPercent(fallbackArtists);

        return {
          artists: [],
          tags: tags.length > 0 ? tags : undefined,
          fallbackArtists: normalizedFallback,
        };
      }

      // Если есть пересечения, возвращаем их
      const normalized = normalizeToPercent(intersection);

      return {
        artists: normalized,
        tags: tags.length > 0 ? tags : undefined,
      };
    }

    case "by-tags": {
      const signals: MusicSignal[] = input.tags!.map((t) => ({
        kind: "tag",
        source: "user",
        value: t,
        weight: 1,
      }));

      const result = await buildRecommendations(signals, apiKey);
      const normalized = normalizeToPercent(result);

      return {
        artists: normalized,
      };
    }

    case "artist+tags": {
      const allSignals = (
        await Promise.all(
          input.artists!.map((a) =>
            collectSignalsForArtist(a, { lastfm: apiKey }),
          ),
        )
      ).flat();

      const artistSignals = allSignals.filter((s) => s.kind === "artist");

      const userTagSignals: MusicSignal[] = input.tags!.map((t) => ({
        kind: "tag",
        source: "user",
        value: t,
        weight: 1,
      }));

      const result = await buildRecommendations(
        [...artistSignals, ...userTagSignals],
        apiKey,
      );
      const normalized = normalizeToPercent(result);

      const allTags = [
        ...extractUniqueTags(allSignals),
        ...input.tags!.map((t) => normalizeTag(t)),
      ];
      const uniqueTags = Array.from(new Set(allTags)).sort();

      return {
        artists: normalized,
        tags: uniqueTags.length > 0 ? uniqueTags : undefined,
      };
    }
  }
}
