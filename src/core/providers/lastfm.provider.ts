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

export async function getSimilarArtists(artist: string, apiKey: string) {
  const params = new URLSearchParams({
    method: "artist.getsimilar",
    artist,
    api_key: apiKey,
    format: "json",
    limit: "20",
    autocorrect: "1",
  });

  const data = await fetchLastFM(params);
  return data?.similarartists?.artist ?? [];
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
