import { ApiRateLimiter } from "../utils/api-rate-limiter";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

const spotifyRateLimiter = new ApiRateLimiter(
  Number(process.env.SPOTIFY_RATE_LIMIT_MS) || 250,
);

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(
        `Spotify token request failed: ${res.status} ${res.statusText}. ${errorText}`,
      );
    }

    const data: SpotifyToken = await res.json();

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Spotify token request failed: ${String(err)}`);
  }
}

const SPOTIFY_429_RETRY_MS = Number(process.env.SPOTIFY_429_RETRY_MS) || 2000;

async function fetchSpotifyAPI(endpoint: string, retried = false): Promise<any> {
  await spotifyRateLimiter.wait();

  const token = await getAccessToken();

  if (!token || token.length === 0) {
    throw new Error("Spotify access token is empty");
  }

  const url = `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, SPOTIFY_429_RETRY_MS));
    return fetchSpotifyAPI(endpoint, true);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Spotify API error: ${res.status} ${res.statusText}. ${errorText}`,
    );
  }

  return res.json();
}

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
}

export async function searchArtist(artistName: string): Promise<SpotifyArtist | null> {
  try {
    const params = new URLSearchParams({
      q: artistName,
      type: "artist",
      limit: "1",
    });

    const data = await fetchSpotifyAPI(`/search?${params.toString()}`);

    const artists = data?.artists?.items;
    if (!artists || artists.length === 0) {
      return null;
    }

    return {
      id: artists[0].id,
      name: artists[0].name,
      popularity: artists[0].popularity || 0,
    };
  } catch (err) {
    console.warn(
      `[Spotify] Search failed for artist: ${artistName}. ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Получает артиста по ID из Spotify (для тестирования)
 */
export async function getArtistById(artistId: string): Promise<any> {
  const endpoint = `/artists/${encodeURIComponent(artistId)}`;
  return await fetchSpotifyAPI(endpoint);
}
