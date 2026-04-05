import { lastfmRateLimiter } from "../utils/api-rate-limiter";
import { TimedCache } from "../utils/timed-cache";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";
import { isSensibleArtistName } from "../utils/normalize";
import { HttpError } from "../utils/http-error";

const API_URL = "https://ws.audioscrobbler.com/2.0/";

const USER_AGENT =
  process.env.LASTFM_USER_AGENT ||
  "music-similarity-bot/0.1 ( chuka-kauchuka@mail.ru )";

const HEADERS = {
  "User-Agent": USER_AGENT,
};

const LASTFM_CACHE_TTL_MS = Number(process.env.LASTFM_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const LASTFM_TIMEOUT_MS = Number(process.env.LASTFM_TIMEOUT_MS) || 10_000;

const responseCache = new TimedCache<any>(LASTFM_CACHE_TTL_MS);

function lastfmCacheKey(params: URLSearchParams): string {
  const entries = Array.from(params.entries())
    .filter(([k]) => k !== "api_key")
    .sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

async function fetchLastFM(params: URLSearchParams): Promise<any> {
  const key = lastfmCacheKey(params);
  const cached = responseCache.get(key);
  if (cached) return cached;

  await lastfmRateLimiter.wait();

  const res = await fetchWithTimeout(`${API_URL}?${params.toString()}`, {
    headers: HEADERS,
    timeoutMs: LASTFM_TIMEOUT_MS,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new HttpError(
      res.status,
      `Last.fm API error: ${res.status} ${res.statusText}. ${errorText}`,
    );
  }

  const data = await res.json();
  responseCache.set(key, data);
  return data;
}

async function searchLastfmArtistOnce(
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

export async function searchLastfmArtist(
  artist: string,
  apiKey: string,
): Promise<{ name: string; mbid: string | null } | null> {
  const trimmed = artist.trim();
  let result = await searchLastfmArtistOnce(trimmed, apiKey);
  if (!result && trimmed.includes("+")) {
    const withSpaces = trimmed.replace(/\s*\+\s*/g, " + ");
    if (withSpaces !== trimmed) {
      result = await searchLastfmArtistOnce(withSpaces, apiKey);
    }
  }
  return result;
}

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
