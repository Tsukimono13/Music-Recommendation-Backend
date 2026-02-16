const API_URL = "https://ws.audioscrobbler.com/2.0/";

const USER_AGENT =
  process.env.LASTFM_USER_AGENT ||
  "music-similarity-bot/0.1 ( chuka-kauchuka@mail.ru )";

const HEADERS = {
  "User-Agent": USER_AGENT,
};

async function fetchLastFM(params: URLSearchParams) {
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

    return res.json();
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Last.fm request failed: ${String(err)}`);
  }
}

export async function searchArtist(
  artist: string,
  apiKey: string,
): Promise<{ name: string; mbid: string | null } | null> {
  const params = new URLSearchParams({
    method: "artist.search",
    artist: artist.trim(),
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
