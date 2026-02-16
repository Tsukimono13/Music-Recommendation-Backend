import { QueryInput } from "../models/query-input.model";
import { detectQueryMode } from "./query-mode.service";
import { collectSignalsForArtist } from "./signals.service";
import { buildRecommendations } from "./recommend.service";
import { intersectArtistSignals } from "./intersection.service";
import { MusicSignal } from "../models/music-signal.model";
import { normalizeTag, normalizeArtistName, isSensibleArtistName } from "../utils/normalize";
import { searchArtist } from "../providers/spotify.provider";

export interface QueryResult {
  artists: { artist: string; score: number; spotifyUrl?: string }[];
  tags?: string[];
  fallbackArtists?: { artist: string; score: number; spotifyUrl?: string }[];
  notFoundArtists?: string[];
  notFoundTags?: string[];
}

function normalizeToPercent(
  results: { artist: string; score: number; spotifyUrl?: string }[],
): { artist: string; score: number; spotifyUrl?: string }[] {
  if (results.length === 0) return [];

  const maxScore = results[0]?.score ?? 1;
  if (maxScore === 0) return results;

  return results.map((item) => ({
    artist: item.artist,
    score: Math.round((item.score / maxScore) * 100),
    spotifyUrl: item.spotifyUrl,
  }));
}


async function enrichArtistsWithSpotifyUrls(
  artists: { artist: string; score: number }[],
): Promise<{ enriched: { artist: string; score: number; spotifyUrl?: string }[] }> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return {
      enriched: artists.map((a) => ({ ...a })),
    };
  }

  const enriched = await Promise.all(
    artists.map(async (item) => {
      if (!item.artist?.trim()) return { ...item };
      try {
        const spotifyArtist = await searchArtist(item.artist);
        if (spotifyArtist) {
          return {
            ...item,
            spotifyUrl: `https://open.spotify.com/artist/${spotifyArtist.id}`,
          };
        }
      } catch (err) {
        console.warn(
          `[Spotify] Failed to find artist "${item.artist}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return { ...item };
    }),
  );

  return { enriched };
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
      const normalized = normalizeToPercent(result.artists);
      const { enriched } = await enrichArtistsWithSpotifyUrls(normalized);

      const tags = extractUniqueTags(signals);

      return {
        artists: enriched,
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
            if (!isSensibleArtistName(item.artist)) continue;
            const key = normalizeArtistName(item.artist);
            if (!seen.has(key)) {
              seen.add(key);
              fallbackArtists.push(item);
            }
          }
        }

        const normalizedFallback = normalizeToPercent(fallbackArtists);
        const { enriched: enrichedFallback } = await enrichArtistsWithSpotifyUrls(normalizedFallback);

        return {
          artists: [],
          tags: tags.length > 0 ? tags : undefined,
          fallbackArtists: enrichedFallback,
        };
      }

      // Если есть пересечения, возвращаем их
      const normalized = normalizeToPercent(intersection);
      const { enriched } = await enrichArtistsWithSpotifyUrls(normalized);

      return {
        artists: enriched,
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
      const normalized = normalizeToPercent(result.artists);
      const { enriched } = await enrichArtistsWithSpotifyUrls(normalized);

      return {
        artists: enriched,
      };
    }

    case "artist+tags": {
      const notFoundArtists: string[] = [];

      // Собираем сигналы для каждого артиста отдельно, чтобы проверить результаты
      const artistSignalsResults = await Promise.all(
        input.artists!.map(async (artistName) => {
          const signals = await collectSignalsForArtist(artistName, {
            lastfm: apiKey,
          });
          const similarArtists = signals.filter(
            (s) => s.kind === "artist" && s.source === "lastfm",
          );
          return {
            artistName,
            signals,
            hasSimilar: similarArtists.length > 0,
          };
        }),
      );

      // Проверяем, какие артисты не дали похожих артистов
      for (const result of artistSignalsResults) {
        if (!result.hasSimilar) {
          notFoundArtists.push(result.artistName);
        }
      }

      // Объединяем все сигналы
      const allSignals = artistSignalsResults.flatMap((r) => r.signals);
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

      const normalized = normalizeToPercent(result.artists);
      const { enriched } = await enrichArtistsWithSpotifyUrls(normalized);

      const allTags = [
        ...extractUniqueTags(allSignals),
        ...input.tags!.map((t) => normalizeTag(t)),
      ];
      const uniqueTags = Array.from(new Set(allTags)).sort();

      return {
        artists: enriched,
        tags: uniqueTags.length > 0 ? uniqueTags : undefined,
        notFoundArtists: notFoundArtists.length > 0 ? notFoundArtists : undefined,
        notFoundTags: result.notFoundTags.length > 0 ? result.notFoundTags : undefined,
      };
    }
  }
}
