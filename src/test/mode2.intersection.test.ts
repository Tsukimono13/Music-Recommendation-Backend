import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

const apiKey = process.env.LASTFM_API_KEY!;

(async () => {
  if (!apiKey) {
    console.error("LASTFM_API_KEY не задан.");
    process.exit(1);
  }

  console.log("\n=== MODE 2: INTERSECTION (пересечение похожих артистов) ===\n");

  // 1) Ария, Мастер, Эпидемия — один круг русского металла, пересечение должно быть
  console.log("1️⃣ Пересечение: Земфира, Мумий Тролль");
  const result = await resolveQuery(
    { artists: ["Земфира", "Мумий Тролль"] },
    apiKey,
  );

  console.log(`   Найдено артистов в пересечении: ${result.artists.length}`);

  if (result.artists.length > 0) {
    console.log("   Топ результатов:");
    result.artists.slice(0, 12).forEach((item, idx) => {
      const spotify = item.spotifyUrl ? "✅" : "❌";
      console.log(`     ${idx + 1}. ${item.artist} — ${item.score}% ${spotify}`);
    });
    if (result.tags?.length) {
      console.log(`   Теги: ${result.tags.slice(0, 8).join(", ")}`);
    }
    const withSpotify = result.artists.filter((a) => a.spotifyUrl).length;
    console.log(`   С Spotify: ${withSpotify}/${result.artists.length}`);
  } else {
    console.log("   Пересечений нет — показываем fallback.");
    if (result.fallbackArtists?.length) {
      result.fallbackArtists.slice(0, 8).forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.artist} — ${item.score}%`);
      });
    }
  }

  console.log("\n" + "—".repeat(50));

  // 2) Metallica + Iron Maiden — для сравнения
  console.log("\n2️⃣ Пересечение: Metallica, Iron Maiden");
  const test2 = await resolveQuery(
    { artists: ["Metallica", "Iron Maiden"] },
    apiKey,
  );
  console.log(`   Найдено: ${test2.artists.length}`);
  test2.artists.slice(0, 6).forEach((item, idx) => {
    console.log(`     ${idx + 1}. ${item.artist} — ${item.score}%`);
  });

  console.log("\n" + "—".repeat(50));

  // 3) Группы без пересечений — fallback
  console.log("\n3️⃣ Без пересечений (fallback): Rolling Stones, Rammstein");
  const test3 = await resolveQuery(
    { artists: ["Rolling Stones", "Rammstein"] },
    apiKey,
  );
  console.log(`   Пересечений: ${test3.artists.length}`);
  if (test3.fallbackArtists?.length) {
    console.log(`   Fallback (топ по каждой группе):`);
    test3.fallbackArtists.forEach((item, idx) => {
      console.log(`     ${idx + 1}. ${item.artist} — ${item.score}%`);
    });
  }

  console.log("\n=== Тесты mode2 завершены ===\n");
})();
