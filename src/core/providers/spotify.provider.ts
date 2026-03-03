const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";

const LOG_RESPONSES = /^1|true|yes$/i.test(process.env.SPOTIFY_LOG_RESPONSES || "");

const REQUESTS_PER_SECOND = Math.min(
  Math.max(1, Number(process.env.SPOTIFY_REQUESTS_PER_SECOND) || 2),
  5,
);
const MIN_INTERVAL_MS = Math.ceil(1000 / REQUESTS_PER_SECOND);

const CACHE_TTL_MS = Number(process.env.SPOTIFY_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const artistIdCache = new Map<
  string,
  { id: string; name: string; cachedAt: number }
>();

function cacheKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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
    if (res.status === 401) {
      console.warn(
        "[Spotify] Token failed (401): check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
      );
    }
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
}

// --- Очередь запросов: один поток, лимит N/сек, при 429 — полная пауза по Retry-After ---

type QueueTask = {
  endpoint: string;
  resolve: (data: any) => void;
  reject: (err: Error) => void;
};

const queue: QueueTask[] = [];
let processing = false;
let lastRequestTime = 0;
/** Пока не истекло — новые поиски не шлём в API, отдаём ответ без ссылок. */
let skipSpotifyUntil = 0;

function waitUntil(until: number): Promise<void> {
  const ms = Math.max(0, until - Date.now());
  if (ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** Пустой ответ поиска: без ссылок. */
const EMPTY_SEARCH = { artists: { items: [] } };

function drainQueueWithoutApi(): void {
  while (queue.length > 0) {
    const task = queue.shift()!;
    if (task.endpoint.includes("/search")) {
      task.resolve(EMPTY_SEARCH);
    } else {
      task.reject(new Error("Spotify 429 — запросы временно отключены"));
    }
  }
}

async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    if (Date.now() < skipSpotifyUntil) {
      drainQueueWithoutApi();
      break;
    }

    await waitUntil(lastRequestTime + MIN_INTERVAL_MS);

    const task = queue.shift()!;
    const token = await getAccessToken();
    const url = `${API_URL}${task.endpoint}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    lastRequestTime = Date.now();
    console.log(`[Spotify] ${task.endpoint.slice(0, 80)} -> ${res.status} ${res.statusText}`);

    if (res.status === 429) {
      const maxWaitSec = Math.min(60, Math.max(5, Number(process.env.SPOTIFY_429_MAX_WAIT_SEC) || 15));
      const raw = res.headers.get("Retry-After") || String(maxWaitSec);
      const retryAfterSec = Math.min(maxWaitSec, Math.max(1, parseInt(raw, 10) || maxWaitSec));
      skipSpotifyUntil = Date.now() + retryAfterSec * 1000;
      console.warn(`[Spotify] 429 — отдаём без ссылок, повтор через ${retryAfterSec}s`);
      task.reject(new Error("Spotify 429"));
      drainQueueWithoutApi();
      break;
    }

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      if (LOG_RESPONSES) console.log("[Spotify] error body:", text.slice(0, 500));
      task.reject(new Error(`Spotify API error: ${res.status} ${res.statusText}. ${text}`));
      continue;
    }

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      task.reject(new Error(`Spotify API invalid JSON: ${text.slice(0, 200)}`));
      continue;
    }

    if (LOG_RESPONSES && data) {
      const preview = JSON.stringify(data).slice(0, 800);
      console.log("[Spotify] response:", preview + (JSON.stringify(data).length > 800 ? "..." : ""));
    }
    task.resolve(data);
  }

  processing = false;
}

function fetchSpotifyAPI(endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    queue.push({ endpoint, resolve, reject });
    processQueue();
  });
}

// --- Публичный API ---

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
}

export async function searchArtist(artistName: string): Promise<SpotifyArtist | null> {
  const key = cacheKey(artistName);
  const cached = artistIdCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    console.log(`[Spotify] search "${artistName}" -> cache hit (${cached.id})`);
    return {
      id: cached.id,
      name: cached.name,
      popularity: 0,
    };
  }

  if (Date.now() < skipSpotifyUntil) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      q: artistName,
      type: "artist",
      limit: "1",
    });
    const data = await fetchSpotifyAPI(`/search?${params.toString()}`);

    const artists = data?.artists?.items;
    if (!artists || artists.length === 0) {
      console.log(`[Spotify] search "${artistName}" -> no results`);
      return null;
    }

    const first = artists[0];
    artistIdCache.set(key, {
      id: first.id,
      name: first.name,
      cachedAt: Date.now(),
    });
    console.log(`[Spotify] search "${artistName}" -> found: ${first.name} (${first.id})`);
    return {
      id: first.id,
      name: first.name,
      popularity: first.popularity || 0,
    };
  } catch (err) {
    console.warn(
      `[Spotify] Search failed for artist: ${artistName}. ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Получает артиста по ID из Spotify (для тестирования).
 * Идёт через ту же очередь.
 */
export async function getArtistById(artistId: string): Promise<any> {
  const endpoint = `/artists/${encodeURIComponent(artistId)}`;
  return await fetchSpotifyAPI(endpoint);
}
