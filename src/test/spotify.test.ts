import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

const hasLastFm = Boolean(process.env.LASTFM_API_KEY);
const hasSpotify = Boolean(
  process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET,
);

/** Группа для проверки — можно поменять. */
const TEST_ARTIST = process.env.SPOTIFY_TEST_ARTIST || "Metallica";

(async () => {
  console.log("=== Тест: запрос рекомендаций для одной группы ===\n");
  console.log(`Группа: "${TEST_ARTIST}"`);
  console.log(`Last.fm: ${hasLastFm ? "✓" : "✗ (нужен LASTFM_API_KEY)"}`);
  console.log(`Spotify: ${hasSpotify ? "✓" : "✗ (ссылок не будет)"}\n`);

  if (!hasLastFm) {
    console.error("Задайте LASTFM_API_KEY в .env для теста.");
    process.exit(1);
  }

  const result = await resolveQuery(
    { artists: [TEST_ARTIST] },
    process.env.LASTFM_API_KEY!,
  );

  console.log("--- Результат ---");
  console.log(`Артистов: ${result.artists.length}`);
  if (result.tags?.length) {
    console.log(`Теги: ${result.tags.slice(0, 8).join(", ")}`);
  }

  const withUrl = result.artists.filter((a) => "spotifyUrl" in a && a.spotifyUrl);
  console.log(`Со ссылкой Spotify: ${withUrl.length}/${result.artists.length}\n`);

  console.log("Топ-10:");
  result.artists.slice(0, 10).forEach((a, i) => {
    const link = "spotifyUrl" in a && a.spotifyUrl ? "✅" : "—";
    console.log(`  ${i + 1}. ${a.artist} — ${a.score}% ${link}`);
  });

  if (result.artists.length === 0) {
    console.error("\n❌ Нет артистов в ответе.");
    process.exit(1);
  }

  console.log("\n✅ Запрос отработал.");
})();
