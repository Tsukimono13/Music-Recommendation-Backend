import { MusicSignal } from "../models/music-signal.model";
import { getTopArtistsByTag } from "../providers/lastfm.provider";
import { normalizeArtistName } from "../utils/normalize";

export interface TagExpandResult {
  signals: MusicSignal[];
  notFoundTags: string[];
  _debug?: string[];
}

const DECADE_WORDS = new Set(["70s", "80s", "90s", "2000s", "2010s"]);
const FALLBACK_LIMIT = 200;
const MIN_INTERSECTION_SIZE = 3;

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

/**
 * Разворачивает один тег в список артистов.
 * Для составных тегов (эпоха+жанр) пробует пересечение через splitEraGenreTag.
 */
async function expandSingleTag(
  tagValue: string,
  tagWeight: number,
  apiKey: string,
  limit?: number,
): Promise<MusicSignal[]> {
  // Для составных тегов (эпоха+жанр) сразу идём в split+intersect,
  // прямые результаты Last.fm для таких тегов ненадёжны
  if (isEraGenreCompoundTag(tagValue)) {
    const split = splitEraGenreTag(tagValue);
    if (split) {
      const [era, genre] = split;
      console.log(`[TagExpand] Compound tag split: "${era}" + "${genre}"`);
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
        // Если пересечение пустое — fallback на union
      }

      // Для составных тегов не возвращаем union — лучше пустой результат,
      // чем мешанина из двух несвязанных списков
      return [];
    }
  }

  const artists = await getTopArtistsByTag(tagValue, apiKey, limit);
  if (artists.length === 0) {
    return [];
  }

  return artists.map((a: { name: string; rank: number }) => ({
    kind: "artist" as const,
    source: "lastfm" as const,
    value: a.name,
    weight: tagWeight * (1 / a.rank),
  }));
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
  const debug: string[] = [];
  const needsIntersection = tagMap.size > 1;
  debug.push(`tags=${JSON.stringify([...tagMap.keys()])}, needsIntersection=${needsIntersection}`);

  // Разворачиваем каждый тег отдельно
  // Для пересечения нужно больше артистов на тег, иначе overlap слишком маленький
  const perTagResults = await Promise.all(
    Array.from(tagMap.entries()).map(async ([tagValue, tagWeight]) => {
      const signals = await expandSingleTag(tagValue, tagWeight, apiKey, needsIntersection ? FALLBACK_LIMIT : undefined);
      if (signals.length === 0) {
        notFoundTags.push(tagValue);
      }
      return { tagValue, signals };
    }),
  );

  const nonEmpty = perTagResults.filter((r) => r.signals.length > 0);
  for (const r of perTagResults) {
    debug.push(`"${r.tagValue}" → ${r.signals.length} artists`);
  }

  // Один тег или все пустые — возвращаем как есть
  if (nonEmpty.length <= 1) {
    debug.push("result=single-tag-passthrough");
    return {
      signals: nonEmpty.flatMap((r) => r.signals),
      notFoundTags,
      _debug: debug,
    };
  }

  // Несколько тегов — пересекаем: оставляем только артистов из всех списков
  const perTagArtistMaps = nonEmpty.map((r) => {
    const map = new Map<string, number>();
    for (const s of r.signals) {
      const key = normalizeArtistName(s.value);
      map.set(key, (map.get(key) ?? 0) + s.weight);
    }
    return map;
  });

  // Ищем артистов, присутствующих во всех тег-списках
  const firstMap = perTagArtistMaps[0];
  const intersectionKeys = new Set<string>();
  for (const key of firstMap.keys()) {
    if (perTagArtistMaps.every((m) => m.has(key))) {
      intersectionKeys.add(key);
    }
  }

  // Собираем display name для каждого ключа (берём первое встреченное)
  const displayNames = new Map<string, string>();
  for (const r of nonEmpty) {
    for (const s of r.signals) {
      const key = normalizeArtistName(s.value);
      if (!displayNames.has(key)) {
        displayNames.set(key, s.value);
      }
    }
  }

  debug.push(`intersection=${intersectionKeys.size} (min=${MIN_INTERSECTION_SIZE})`);

  if (intersectionKeys.size >= MIN_INTERSECTION_SIZE) {
    // Хорошее пересечение — возвращаем только артистов из всех тегов
    const signals: MusicSignal[] = [];
    for (const key of intersectionKeys) {
      const totalWeight = perTagArtistMaps.reduce(
        (sum, m) => sum + (m.get(key) ?? 0),
        0,
      );
      signals.push({
        kind: "artist",
        source: "lastfm",
        value: displayNames.get(key)!,
        weight: totalWeight,
      });
    }
    debug.push(`result=intersection, artists=${signals.length}`);
    return { signals, notFoundTags, _debug: debug };
  }

  // Пересечение слишком маленькое — объединяем, но артисты
  // из нескольких тегов получают бонус к весу
  const tagCount = nonEmpty.length;
  const merged = new Map<string, { weight: number; tagCount: number }>();

  for (const tagArtistMap of perTagArtistMaps) {
    for (const [key, weight] of tagArtistMap) {
      const existing = merged.get(key);
      if (existing) {
        existing.weight += weight;
        existing.tagCount++;
      } else {
        merged.set(key, { weight, tagCount: 1 });
      }
    }
  }

  const signals: MusicSignal[] = [];
  for (const [key, entry] of merged) {
    // Бонус: артист из 2/2 тегов получает ×2, из 1/2 — ×1.5
    const multiTagBoost = 1 + entry.tagCount / tagCount;
    signals.push({
      kind: "artist",
      source: "lastfm",
      value: displayNames.get(key)!,
      weight: entry.weight * multiTagBoost,
    });
  }

  debug.push(`result=fallback-union, artists=${signals.length}`);
  return { signals, notFoundTags, _debug: debug };
}
