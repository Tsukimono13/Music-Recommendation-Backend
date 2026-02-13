import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  console.log("=== INTERSECTION MODE TEST ===\n");

  // Тест 1: Группы с возможными пересечениями
  console.log("1️⃣ Тест с группами, которые могут иметь пересечения:");
  const test1 = await resolveQuery(
    {
      artists: ["Metallica", "Iron Maiden"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Найдено артистов: ${test1.artists.length}`);
  console.log("Топ-10 результатов:");
  test1.artists.slice(0, 10).forEach((item, idx) => {
    const spotifyInfo = item.spotifyUrl 
      ? `✅ ${item.spotifyUrl}` 
      : `❌ Spotify не найден`;
    console.log(`  ${idx + 1}. ${item.artist} — ${item.score}%`);
    console.log(`     ${spotifyInfo}`);
  });
  if (test1.tags && test1.tags.length > 0) {
    console.log(`\nТеги: ${test1.tags.slice(0, 10).join(", ")}`);
  }
  
  const withSpotify1 = test1.artists.filter(a => a.spotifyUrl).length;
  console.log(`\n📊 С Spotify: ${withSpotify1}/${test1.artists.length}`);

  console.log("\n" + "=".repeat(50) + "\n");

  // Тест 2: Группы без пересечений (должен сработать fallback на топ-2)
  console.log("2️⃣ Тест с группами без пересечений (fallback на топ-2):");
  const test2 = await resolveQuery(
    {
      artists: ["Rolling Stones", "Rammstein"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Пересечений найдено: ${test2.artists.length}`);
  if (test2.artists.length === 0) {
    console.log("✅ Пересечений нет, используем fallback");
  }

  if (test2.fallbackArtists && test2.fallbackArtists.length > 0) {
    console.log(`\nFallback артистов: ${test2.fallbackArtists.length}`);
    console.log("Топ-2 для каждой группы (в порядке групп):");
    test2.fallbackArtists.forEach((item, idx) => {
      const spotifyInfo = item.spotifyUrl 
        ? `✅ ${item.spotifyUrl}` 
        : `❌ Spotify не найден`;
      console.log(`  ${idx + 1}. ${item.artist} — ${item.score}%`);
      console.log(`     ${spotifyInfo}`);
    });
    
    const withSpotify2 = test2.fallbackArtists.filter(a => a.spotifyUrl).length;
    console.log(`\n📊 Fallback с Spotify: ${withSpotify2}/${test2.fallbackArtists.length}`);
  }

  if (test2.tags && test2.tags.length > 0) {
    console.log(`\nТеги: ${test2.tags.slice(0, 10).join(", ")}`);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Тест 3: Три группы
  console.log("3️⃣ Тест с тремя группами:");
  const test3 = await resolveQuery(
    {
      artists: ["Green Day", "Blink-182", "Sum 41"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Найдено артистов: ${test3.artists.length}`);
  console.log("Топ-10 результатов:");
  test3.artists.slice(0, 10).forEach((item, idx) => {
    const spotifyInfo = item.spotifyUrl 
      ? `✅ ${item.spotifyUrl}` 
      : `❌ Spotify не найден`;
    console.log(`  ${idx + 1}. ${item.artist} — ${item.score}%`);
    console.log(`     ${spotifyInfo}`);
  });
  if (test3.tags && test3.tags.length > 0) {
    console.log(`\nТеги: ${test3.tags.slice(0, 10).join(", ")}`);
  }
  
  const withSpotify3 = test3.artists.filter(a => a.spotifyUrl).length;
  console.log(`\n📊 С Spotify: ${withSpotify3}/${test3.artists.length}`);
})();
