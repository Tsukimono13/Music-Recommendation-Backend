import { musicBrainzRateLimiter } from "../utils/api-rate-limiter";

const API_URL = "https://musicbrainz.org/ws/2";

const USER_AGENT =
  process.env.MUSICBRAINZ_UA ||
  "music-similarity-bot/0.1 ( chuka-kauchuka@mail.ru )";

const HEADERS = {
  "User-Agent": USER_AGENT,
};

export interface MusicBrainzTag {
  name: string;
  count: number;
}

export async function getMusicBrainzTags(
  artistName: string,
): Promise<MusicBrainzTag[]> {
  // Rate limiting для MusicBrainz
  await musicBrainzRateLimiter.wait();

  const searchParams = new URLSearchParams({
    query: `artist:${artistName}`,
    fmt: "json",
    limit: "1",
  });

  let searchRes: Response;
  try {
    searchRes = await fetch(
      `${API_URL}/artist?${searchParams.toString()}`,
      { headers: HEADERS },
    );

    // Обработка 503 - возвращаем пустой массив вместо ошибки
    if (searchRes.status === 503) {
      console.warn(
        `[MusicBrainz] Rate limit exceeded for artist: ${artistName}. Returning empty tags.`,
      );
      return [];
    }

    if (!searchRes.ok) {
      const errorText = await searchRes.text().catch(() => "Unknown error");
      console.warn(
        `[MusicBrainz] API error ${searchRes.status} for artist: ${artistName}. ${errorText}`,
      );
      return []; // Возвращаем пустой массив вместо ошибки
    }
  } catch (err) {
    console.warn(
      `[MusicBrainz] Request failed for artist: ${artistName}. ${err instanceof Error ? err.message : String(err)}`,
    );
    return []; // Возвращаем пустой массив вместо ошибки
  }

  const searchData = await searchRes.json();
  const artist = searchData.artists?.[0];

  if (!artist?.id) {
    return [];
  }

  // Rate limiting перед вторым запросом
  await musicBrainzRateLimiter.wait();

  let detailsRes: Response;
  try {
    detailsRes = await fetch(
      `${API_URL}/artist/${artist.id}?inc=tags&fmt=json`,
      { headers: HEADERS },
    );

    // Обработка 503 - возвращаем пустой массив вместо ошибки
    if (detailsRes.status === 503) {
      console.warn(
        `[MusicBrainz] Rate limit exceeded for artist details: ${artist.id}. Returning empty tags.`,
      );
      return [];
    }

    if (!detailsRes.ok) {
      const errorText = await detailsRes.text().catch(() => "Unknown error");
      console.warn(
        `[MusicBrainz] API error ${detailsRes.status} for artist details: ${artist.id}. ${errorText}`,
      );
      return []; // Возвращаем пустой массив вместо ошибки
    }
  } catch (err) {
    console.warn(
      `[MusicBrainz] Request failed for artist details: ${artist.id}. ${err instanceof Error ? err.message : String(err)}`,
    );
    return []; // Возвращаем пустой массив вместо ошибки
  }

  const details = await detailsRes.json();

  return details.tags || [];
}
