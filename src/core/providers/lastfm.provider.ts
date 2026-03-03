import { lastfmRateLimiter } from "../utils/api-rate-limiter";

const API_URL = "https://ws.audioscrobbler.com/2.0/";

const USER_AGENT =
  process.env.LASTFM_USER_AGENT ||
  "music-similarity-bot/0.1 ( chuka-kauchuka@mail.ru )";

const HEADERS = {
  "User-Agent": USER_AGENT,
};

/** TTL кэша Last.fm (ответы по одному и тому же запросу не дергают API). */
const LASTFM_CACHE_TTL_MS = Number(process.env.LASTFM_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;

const lastfmResponseCache = new Map<
  string,
  { data: any; cachedAt: number }
>();

function lastfmCacheKey(params: URLSearchParams): string {
  const entries = Array.from(params.entries())
    .filter(([k]) => k !== "api_key")
    .sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

async function fetchLastFM(params: URLSearchParams): Promise<any> {
  const key = lastfmCacheKey(params);
  const cached = lastfmResponseCache.get(key);
  if (cached && Date.now() - cached.cachedAt < LASTFM_CACHE_TTL_MS) {
    return cached.data;
  }

  await lastfmRateLimiter.wait();
  try {
    const res = await fetch(`${API_URL}?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(
        `Last.fm API error: ${res.status} ${res.statusText}. ${errorText}`,
      );
    }

    const data = await res.json();
    lastfmResponseCache.set(key, { data, cachedAt: Date.now() });
    return data;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Last.fm request failed: ${String(err)}`);
  }
}

async function searchArtistOnce(
  artistQuery: string,
  apiKey: string,
): Promise<{ name: string; mbid: string | null } | null> {
  const params = new URLSearchParams({
    method: "artist.search",
    artist: artistQuery,
    api_key: apiKey,
    format: "json",
    limit: "5",
  });

  const data = await fetchLastFM(params);
  const list = data?.results?.artistmatches?.artist;
  if (!list?.length) return null;

  const first = Array.isArray(list) ? list[0] : list;
  const mbid = first.mbid?.trim() || null;
  const name = first.name?.trim();
  if (!name) return null;

  return { name, mbid };
}

/** Resolve artist; if name contains "+" and search finds nothing, retry with " + " (spaces) — Last.fm often stores "Ost + Front". */
export async function searchArtist(
  artist: string,
  apiKey: string,
): Promise<{ name: string; mbid: string | null } | null> {
  const trimmed = artist.trim();
  let result = await searchArtistOnce(trimmed, apiKey);
  if (!result && trimmed.includes("+")) {
    const withSpaces = trimmed.replace(/\s*\+\s*/g, " + ");
    if (withSpaces !== trimmed) {
      result = await searchArtistOnce(withSpaces, apiKey);
    }
  }
  return result;
}

import { isSensibleArtistName } from "../utils/normalize";

export async function getSimilarArtists(
  artist: string,
  apiKey: string,
  options?: { mbid?: string | null },
) {
  const params = new URLSearchParams({
    method: "artist.getsimilar",
    api_key: apiKey,
    format: "json",
    limit: "100",
  });

  if (options?.mbid) {
    params.set("mbid", options.mbid);
  } else {
    params.set("artist", artist.trim());
    params.set("autocorrect", "1");
  }

  const data = await fetchLastFM(params);
  const raw = data?.similarartists?.artist ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((a: { name?: string }) =>
    isSensibleArtistName(String(a?.name ?? "").trim()),
  );
}

export async function getArtistTopTags(
  artist: string,
  apiKey: string,
): Promise<{ name: string; count: number }[]> {
  const params = new URLSearchParams({
    method: "artist.getTopTags",
    artist,
    api_key: apiKey,
    format: "json",
    autocorrect: "1",
  });

  const data = await fetchLastFM(params);

  const tags = data?.toptags?.tag;
  if (!tags) return [];

  const list = Array.isArray(tags) ? tags : [tags];

  return list.map((t: any) => ({
    name: t.name,
    count: Number(t.count) || 1,
  }));
}

export async function getTopArtistsByTag(
  tag: string,
  apiKey: string,
  limit = 20,
): Promise<{ name: string; rank: number }[]> {
  const params = new URLSearchParams({
    method: "tag.getTopArtists",
    tag,
    api_key: apiKey,
    format: "json",
    limit: String(limit),
  });

  const data = await fetchLastFM(params);

  return (
    data?.topartists?.artist?.map((a: any) => ({
      name: a.name,
      rank: Number(a["@attr"]?.rank || 50),
    })) ?? []
  );
}
