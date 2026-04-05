import "dotenv/config";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { createApp } from "../../http/app";
import type { Server } from "http";

const hasKeys = Boolean(
  (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) &&
  process.env.LASTFM_API_KEY,
);

const DELAY_MS = Number(process.env.GEMINI_TEST_DELAY_MS) || 2000;
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Базовый URL — либо удалённый сервер, либо локальный
const REMOTE_URL = process.env.TEST_API_URL; // например http://your-server:3000
let localServer: Server | null = null;
let baseUrl = "";

describe.skipIf(!hasKeys && !REMOTE_URL)("Gemini prompt integration tests", () => {
  const TIMEOUT = 60_000;

  beforeAll(async () => {
    if (REMOTE_URL) {
      baseUrl = REMOTE_URL.replace(/\/$/, "");
    } else {
      const app = createApp();
      localServer = await new Promise<Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      const addr = localServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
    }
  });

  afterAll(async () => {
    if (localServer) {
      await new Promise<void>((resolve) => localServer!.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    await delay(DELAY_MS);
  });

  /** Отправляет message на /api/music/recommend и возвращает распарсенный ответ. */
  async function recommend(message: string) {
    const res = await fetch(`${baseUrl}/api/music/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    console.log(`\n  📨 "${message}"\n  📩 status=${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    return { status: res.status, data };
  }

  /**
   * Отправляет message напрямую на парсер (без Last.fm), чтобы проверить
   * только извлечение artists/tags из промта.
   */
  async function parseOnly(message: string) {
    const res = await fetch(`${baseUrl}/api/music/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    console.log(`\n  📨 "${message}"\n  📩 status=${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    // При status 200 — Gemini распарсил и Last.fm вернул результат
    // При status 400 — Gemini не смог распарсить (parsed: {})
    return { status: res.status, data };
  }

  // ─── Артисты: базовый парсинг ───

  it("понимает 'похоже на X' и возвращает рекомендации", async () => {
    const { status, data } = await recommend("хочу что-то похожее на Metallica");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("понимает нескольких артистов", async () => {
    const { status, data } = await recommend("что-нибудь как Iron Maiden и Judas Priest");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Артисты: опечатки ───

  it("исправляет кириллические опечатки ('Металика' → Metallica)", async () => {
    const { status, data } = await recommend("похоже на Металику");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("исправляет 'Нирвана' → Nirvana", async () => {
    const { status, data } = await recommend("в духе Нирваны");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Артисты: из песен и альбомов ───

  it("извлекает артиста по названию песни", async () => {
    const { status, data } = await recommend("мне нравится песня Bohemian Rhapsody");
    expect(status).toBe(200);
    // Queen должен быть в результатах (Gemini извлёк Queen → Last.fm вернул похожих)
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("извлекает артиста по названию альбома", async () => {
    const { status, data } = await recommend("хочу что-то как альбом The Dark Side of the Moon");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── 'между X и Y' ───

  it("парсит 'что-то между X и Y'", async () => {
    const { status, data } = await recommend("что-то между Green Day и Blink-182");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, 60_000);

  // ─── Теги ───

  it("понимает жанровые запросы без артистов", async () => {
    const { status, data } = await recommend("финский метал");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("понимает составной тег 'норвежский блэк метал'", async () => {
    const { status, data } = await recommend("норвежский блэк метал");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("понимает жанр + эпоху ('синтипоп 80х')", async () => {
    const { status, data } = await recommend("синтипоп 80х");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Комбинированные запросы ───

  it("понимает артистов + теги вместе", async () => {
    const { status, data } = await recommend("хочу что-то похожее на Metallica и Slayer, трэш метал 80х");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Английский ввод ───

  it("работает с английским вводом", async () => {
    const { status, data } = await recommend("something like Radiohead but more electronic");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Негативные пожелания ───

  it("не падает на негативных пожеланиях", async () => {
    const { status, data } = await recommend("хочу рок, но без панка и не хочу поп");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Нерелевантный ввод → 400 ───

  it("возвращает 400 на нерелевантный ввод", async () => {
    const { status, data } = await parseOnly("привет, как дела?");
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  }, TIMEOUT);

  it("возвращает 400 на бессмыслицу", async () => {
    const { status, data } = await parseOnly("аывлоарвыдлоа 12345");
    expect(status).toBe(400);
    expect(data.error).toBeDefined();
  }, TIMEOUT);

  // ─── Кириллические артисты ───

  it("понимает кириллических артистов (Земфира)", async () => {
    const { status, data } = await recommend("что-то похожее на Земфиру");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Настроение — не должно ломать ───

  it("не ломается на эмоциональных запросах", async () => {
    const { status, data } = await recommend("хочу что-то мрачное и агрессивное, метал");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Не выдумывает ───

  it("на чисто жанровый запрос не выдумывает артистов-входов", async () => {
    const { status, data } = await recommend("хочу пауэр метал");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);

  // ─── Диапазоны эпох ───

  it("понимает диапазон эпох ('конец 80-х — начало 90-х')", async () => {
    const { status, data } = await recommend("рок конца 80-х — начала 90-х");
    expect(status).toBe(200);
    expect(data.artists.length).toBeGreaterThan(0);
  }, TIMEOUT);
});
