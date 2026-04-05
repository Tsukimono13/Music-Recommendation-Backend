import { TimedCache } from "../utils/timed-cache";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

const LOG_RESPONSES = /^1|true|yes$/i.test(process.env.SPOTIFY_LOG_RESPONSES || "");

const MAX_CONCURRENT = Math.min(
  Math.max(1, Number(process.env.SPOTIFY_MAX_CONCURRENT) || 5),
  10,
);

const CACHE_TTL_MS = Number(process.env.SPOTIFY_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const SPOTIFY_TIMEOUT_MS = Number(process.env.SPOTIFY_TIMEOUT_MS) || 10_000;

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
}

const EMPTY_SEARCH = { artists: { items: [] } };

class SpotifyClient {
  private artistCache = new TimedCache<{ id: string; name: string }>(CACHE_TTL_MS);
  private cachedToken: { token: string; expiresAt: number } | null = null;
  private skipUntil = 0;
  private running = 0;

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
    }

    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetchWithTimeout(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
      timeoutMs: SPOTIFY_TIMEOUT_MS,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      if (res.status === 401) {
        console.warn("[Spotify] Token failed (401): check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
      }
      throw new Error(`Spotify token request failed: ${res.status} ${res.statusText}. ${errorText}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }

  private async fetchAPI(endpoint: string): Promise<any> {
    if (Date.now() < this.skipUntil) {
      if (endpoint.includes("/search")) return EMPTY_SEARCH;
      throw new Error("Spotify 429 — requests temporarily disabled");
    }

    // Простой семафор — ждём пока слот освободится
    while (this.running >= MAX_CONCURRENT) {
      await new Promise((r) => setTimeout(r, 50));
    }
    this.running++;

    try {
      const token = await this.getAccessToken();
      const url = `${API_URL}${endpoint}`;

      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeoutMs: SPOTIFY_TIMEOUT_MS,
      });

      console.log(`[Spotify] ${endpoint.slice(0, 80)} -> ${res.status} ${res.statusText}`);

      if (res.status === 429) {
        const maxWaitSec = Math.min(60, Math.max(5, Number(process.env.SPOTIFY_429_MAX_WAIT_SEC) || 15));
        const raw = res.headers.get("Retry-After") || String(maxWaitSec);
        const retryAfterSec = Math.min(maxWaitSec, Math.max(1, parseInt(raw, 10) || maxWaitSec));
        this.skipUntil = Date.now() + retryAfterSec * 1000;
        console.warn(`[Spotify] 429 — skipping requests for ${retryAfterSec}s`);
        throw new Error("Spotify 429");
      }

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        if (LOG_RESPONSES) console.log("[Spotify] error body:", text.slice(0, 500));
        throw new Error(`Spotify API error: ${res.status} ${res.statusText}. ${text}`);
      }

      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Spotify API invalid JSON: ${text.slice(0, 200)}`);
      }

      if (LOG_RESPONSES && data) {
        const preview = JSON.stringify(data).slice(0, 800);
        console.log("[Spotify] response:", preview + (JSON.stringify(data).length > 800 ? "..." : ""));
      }

      return data;
    } finally {
      this.running--;
    }
  }

  async searchArtist(artistName: string): Promise<SpotifyArtist | null> {
    const key = artistName.trim().toLowerCase().replace(/\s+/g, " ");
    const cached = this.artistCache.get(key);
    if (cached) {
      return { id: cached.id, name: cached.name, popularity: 0 };
    }

    if (Date.now() < this.skipUntil) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        q: artistName,
        type: "artist",
        limit: "1",
      });
      const data = await this.fetchAPI(`/search?${params.toString()}`);

      const artists = data?.artists?.items;
      if (!artists || artists.length === 0) {
        return null;
      }

      const first = artists[0];
      this.artistCache.set(key, { id: first.id, name: first.name });
      return {
        id: first.id,
        name: first.name,
        popularity: first.popularity || 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Spotify] Search failed for artist: ${artistName}. ${msg}`);
      if (msg.includes("403")) throw err;
      return null;
    }
  }

  async getArtistById(artistId: string): Promise<any> {
    const endpoint = `/artists/${encodeURIComponent(artistId)}`;
    return await this.fetchAPI(endpoint);
  }
}

const spotifyClient = new SpotifyClient();

export function searchSpotifyArtist(artistName: string): Promise<SpotifyArtist | null> {
  return spotifyClient.searchArtist(artistName);
}

export function getArtistById(artistId: string): Promise<any> {
  return spotifyClient.getArtistById(artistId);
}
