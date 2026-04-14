import { QueryInput } from "../models/query-input.model";
import { detectQueryMode } from "./query-mode.service";
import { collectSignalsForArtist, ArtistSignalsResult } from "./signals.service";
import { buildRecommendations } from "./recommend.service";
import { intersectArtistSignals } from "./intersection.service";
import { MusicSignal } from "../models/music-signal.model";
import { normalizeTag, normalizeArtistName, normalizeArtistDisplayName, isSensibleArtistName } from "../utils/normalize";
import { searchSpotifyArtist } from "../providers/spotify.provider";

// ── Fallback: если Gemini изменил имя артиста и Last.fm не нашёл похожих,
// ── пробуем оригинальное написание из сообщения пользователя ──

/**
 * Простое посимвольное расстояние (количество различающихся позиций + разница длин).
 * Не полноценный Левенштейн, но достаточно для обнаружения Louna→Loona, Aria→Ария и т.п.
 */
function charDiffCount(a: string, b: string): number {
  const minLen = Math.min(a.length, b.length);
  let diffs = Math.abs(a.length - b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) diffs++;
  }
  return diffs;
}

/**
 * Ищет в оригинальном сообщении слова/фразы, похожие на имя от Gemini,
 * но написанные иначе (Louna vs Loona). Возвращает кандидатов для fallback.
 */
function extractAlternativeNames(geminiName: string, originalMessage: string): string[] {
  const lowerName = geminiName.toLowerCase();
  const lowerMsg = originalMessage.toLowerCase();

  // Точное совпадение — Gemini ничего не менял, fallback не нужен
  if (lowerMsg.includes(lowerName)) return [];

  const words = originalMessage.split(/[\s,;!?.]+/).filter((w) => w.length >= 2);
  const nameParts = geminiName.split(/\s+/);
  const alternatives: string[] = [];

  if (nameParts.length === 1) {
    // Однословное имя — ищем похожее слово
    for (const word of words) {
      const lw = word.toLowerCase();
      if (lw === lowerName) continue;
      // Тот же скрипт (оба латиница или оба кириллица), первая буква совпадает,
      // длина ±2, расхождение ≤ 2 символа
      if (
        lw[0] === lowerName[0] &&
        Math.abs(lw.length - lowerName.length) <= 2 &&
        charDiffCount(lw, lowerName) <= 2
      ) {
        alternatives.push(word);
      }
    }
  } else {
    // Многословное имя — ищем n-грамму той же длины
    const n = nameParts.length;
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      const lp = phrase.toLowerCase();
      if (lp === lowerName) continue;
      if (charDiffCount(lp, lowerName) <= 2) {
        alternatives.push(phrase);
      }
    }
  }

  return alternatives;
}

/**
 * Обёртка над collectSignalsForArtist с fallback:
 * если артист от Gemini не дал похожих на Last.fm,
 * пробуем оригинальное написание из сообщения.
 */
async function collectSignalsWithFallback(
  artistName: string,
  apiKeys: { lastfm: string },
  originalMessage?: string,
): Promise<ArtistSignalsResult> {
  const result = await collectSignalsForArtist(artistName, apiKeys);

  const hasSimilar = result.signals.some(
    (s) => s.kind === "artist" && s.source === "lastfm",
  );

  if (hasSimilar || !originalMessage) return result;

  // Нет похожих артистов — пробуем альтернативные имена из оригинального сообщения
  const alternatives = extractAlternativeNames(artistName, originalMessage);
  for (const alt of alternatives) {
    const altResult = await collectSignalsForArtist(alt, apiKeys);
    const altHasSimilar = altResult.signals.some(
      (s) => s.kind === "artist" && s.source === "lastfm",
    );
    if (altHasSimilar) {
      console.info(
        `[Fallback] Gemini вернул "${artistName}", но Last.fm не нашёл похожих. Использован оригинал "${alt}" из сообщения.`,
      );
      return altResult;
    }
  }

  return result;
}

export interface QueryResult {
  artists: { artist: string; score: number; spotifyUrl?: string }[];
  tags?: string[];
  fallbackArtists?: { artist: string; score: number; spotifyUrl?: string }[];
  fallbackReason?: string;
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
    artist: normalizeArtistDisplayName(item.artist),
    score: Math.round((item.score / maxScore) * 100),
    spotifyUrl: item.spotifyUrl,
  }));
}


const ENRICHMENT_TIMEOUT_MS = Number(process.env.SPOTIFY_ENRICHMENT_TIMEOUT_MS) || 5_000;

async function enrichArtistsWithSpotifyUrls(
  artists: { artist: string; score: number }[],
): Promise<{ enriched: { artist: string; score: number; spotifyUrl?: string }[] }> {
  const hasId = Boolean(process.env.SPOTIFY_CLIENT_ID);
  const hasSecret = Boolean(process.env.SPOTIFY_CLIENT_SECRET);

  if (!hasId || !hasSecret) {
    console.warn(
      "[Spotify] Enrichment skipped: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set. Set both in env to get artist links.",
    );
    return { enriched: artists.map((a) => ({ ...a })) };
  }

  const skipEnrichment =
    process.env.SPOTIFY_SKIP_ENRICHMENT === "1" ||
    process.env.SPOTIFY_SKIP_ENRICHMENT === "true";
  if (skipEnrichment) {
    return { enriched: artists.map((a) => ({ ...a })) };
  }

  const maxToEnrich = Number(process.env.SPOTIFY_MAX_ARTISTS_TO_ENRICH) || 100;
  const toEnrich = artists.slice(0, maxToEnrich);
  const enriched: { artist: string; score: number; spotifyUrl?: string }[] = artists.map((a) => ({ ...a }));

  if (toEnrich.length === 0) {
    return { enriched };
  }

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), ENRICHMENT_TIMEOUT_MS),
  );

  const lookups = Promise.allSettled(
    toEnrich.map(async (item, i) => {
      if (!item.artist?.trim()) return;
      const spotifyArtist = await searchSpotifyArtist(item.artist);
      if (spotifyArtist) {
        enriched[i].spotifyUrl = `https://open.spotify.com/artist/${spotifyArtist.id}`;
      }
    }),
  );

  const result = await Promise.race([lookups, timeout]);
  if (result === "timeout") {
    console.warn(`[Spotify] Enrichment timed out after ${ENRICHMENT_TIMEOUT_MS}ms`);
  }

  const withUrl = enriched.filter((a) => a.spotifyUrl).length;
  if (artists.length > 0 && withUrl === 0) {
    console.warn(
      `[Spotify] No links found for ${artists.length} artists. Check rate limit (429), credentials, or artist name format.`,
    );
  }

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

function excludeInputArtists(
  results: { artist: string; score: number; spotifyUrl?: string }[],
  inputArtists: string[],
): { artist: string; score: number; spotifyUrl?: string }[] {
  if (inputArtists.length === 0) return results;
  const inputKeys = new Set(inputArtists.map((a) => normalizeArtistName(a)));
  return results.filter((r) => !inputKeys.has(normalizeArtistName(r.artist)));
}

export async function resolveQuery(
  input: QueryInput,
  apiKey: string,
): Promise<QueryResult> {
  const mode = detectQueryMode(input);

  switch (mode) {
    case "single": {
      const { signals, canonicalName } = await collectSignalsWithFallback(input.artists![0], {
        lastfm: apiKey,
      }, input.originalMessage);

      const artistSignals = signals.filter(
        (s) => s.kind === "artist" && s.source === "lastfm",
      );

      const result = await buildRecommendations(artistSignals, apiKey);
      const filtered = excludeInputArtists(result.artists, [input.artists![0], canonicalName]);
      const normalized = normalizeToPercent(filtered);
      const { enriched } = await enrichArtistsWithSpotifyUrls(normalized);

      const tags = extractUniqueTags(signals);

      return {
        artists: enriched,
        tags: tags.length > 0 ? tags : undefined,
      };
    }

    case "intersection": {
      const results = await Promise.all(
        input.artists!.map((a) =>
          collectSignalsWithFallback(a, { lastfm: apiKey }, input.originalMessage),
        ),
      );

      const all = results.map((r) => r.signals);
      const canonicalNames = results.map((r) => r.canonicalName);
      const intersection = intersectArtistSignals(all);

      const allSignalsFlat = all.flat();
      const tags = extractUniqueTags(allSignalsFlat);

      // Если нет пересечений, возвращаем пустой artists и fallbackArtists
      if (intersection.length === 0) {
        const fallbackReason =
          "Нет артистов, похожих на всех указанных сразу. Показаны топ похожих по каждому артисту.";
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

        const filteredFallback = excludeInputArtists(fallbackArtists, [...input.artists!, ...canonicalNames]);
        const normalizedFallback = normalizeToPercent(filteredFallback);
        const { enriched: enrichedFallback } = await enrichArtistsWithSpotifyUrls(normalizedFallback);

        return {
          artists: [],
          tags: tags.length > 0 ? tags : undefined,
          fallbackArtists: enrichedFallback,
          fallbackReason,
        };
      }

      // Если есть пересечения, возвращаем их
      const filtered = excludeInputArtists(intersection, [...input.artists!, ...canonicalNames]);
      const normalized = normalizeToPercent(filtered);
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
        notFoundTags: result.notFoundTags.length > 0 ? result.notFoundTags : undefined,
      };
    }

    case "artist+tags": {
      const notFoundArtists: string[] = [];
      const canonicalNames: string[] = [];

      // Собираем сигналы для каждого артиста отдельно, чтобы проверить результаты
      const artistSignalsResults = await Promise.all(
        input.artists!.map(async (artistName) => {
          const { signals, canonicalName } = await collectSignalsWithFallback(artistName, {
            lastfm: apiKey,
          }, input.originalMessage);
          const similarArtists = signals.filter(
            (s) => s.kind === "artist" && s.source === "lastfm",
          );
          return {
            artistName,
            canonicalName,
            signals,
            hasSimilar: similarArtists.length > 0,
          };
        }),
      );

      // Проверяем, какие артисты не дали похожих артистов
      for (const result of artistSignalsResults) {
        canonicalNames.push(result.canonicalName);
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

      const filtered = excludeInputArtists(result.artists, [...input.artists!, ...canonicalNames]);
      const normalized = normalizeToPercent(filtered);
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
