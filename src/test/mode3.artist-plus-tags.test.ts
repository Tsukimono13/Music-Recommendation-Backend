import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  console.log("\n=== ARTIST + TAGS MODE TEST ===");
  console.log("Артисты: Metallica, Iron Maiden, Led Zeppelin");
  console.log("Теги: heavy metal, classic rock, rock\n");

  const result = await resolveQuery(
    {
      artists: ["Metallica", "Iron Maiden", "Led Zeppelin"],
      tags: ["heavy metal", "classic rock", "rock"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Найдено артистов: ${result.artists.length}\n`);

  // Красивый вывод с Spotify ссылками
  result.artists.slice(0, 10).forEach((item, idx) => {
    const spotifyInfo = item.spotifyUrl 
      ? `✅ Spotify: ${item.spotifyUrl}` 
      : `❌ Spotify: не найден`;
    console.log(`${idx + 1}. ${item.artist} — ${item.score}%`);
    console.log(`   ${spotifyInfo}`);
  });

  if (result.tags && result.tags.length > 0) {
    console.log("\n📋 Теги (информация, не для подсчета):");
    console.log(result.tags.slice(0, 15).join(", "));
  }

  // Не найденные артисты и теги
  if (result.notFoundArtists && result.notFoundArtists.length > 0) {
    console.log("\n⚠️  Не найденные артисты:");
    result.notFoundArtists.forEach((artist) => {
      console.log(`   - ${artist}`);
    });
  }

  if (result.notFoundTags && result.notFoundTags.length > 0) {
    console.log("\n⚠️  Не найденные теги:");
    result.notFoundTags.forEach((tag) => {
      console.log(`   - ${tag}`);
    });
  }

  // Статистика
  const withSpotify = result.artists.filter(a => a.spotifyUrl).length;
  console.log(`\n📊 Статистика:`);
  console.log(`   Всего артистов: ${result.artists.length}`);
  console.log(`   С Spotify ссылкой: ${withSpotify}`);
  console.log(`   Без Spotify ссылки: ${result.artists.length - withSpotify}`);
  if (result.notFoundArtists) {
    console.log(`   Не найдено артистов: ${result.notFoundArtists.length}`);
  }
  if (result.notFoundTags) {
    console.log(`   Не найдено тегов: ${result.notFoundTags.length}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("=== TEST WITH NOT FOUND ARTISTS AND TAGS ===");
  console.log("=".repeat(60) + "\n");

  // Тест с несуществующими артистами и тегами
  const testWithErrors = await resolveQuery(
    {
      artists: ["Pupupipi", "Metallica", "NonExistentArtist123"],
      tags: ["Nerd", "rock", "InvalidTag999"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Найдено артистов: ${testWithErrors.artists.length}\n`);

  if (testWithErrors.artists.length > 0) {
    console.log("Топ-5 результатов:");
    testWithErrors.artists.slice(0, 5).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.artist} — ${item.score}%`);
    });
  }

  if (testWithErrors.notFoundArtists && testWithErrors.notFoundArtists.length > 0) {
    console.log("\n⚠️  Не найденные артисты:");
    testWithErrors.notFoundArtists.forEach((artist) => {
      console.log(`   - ${artist}`);
    });
  }

  if (testWithErrors.notFoundTags && testWithErrors.notFoundTags.length > 0) {
    console.log("\n⚠️  Не найденные теги:");
    testWithErrors.notFoundTags.forEach((tag) => {
      console.log(`   - ${tag}`);
    });
  }

  if (
    (!testWithErrors.notFoundArtists || testWithErrors.notFoundArtists.length === 0) &&
    (!testWithErrors.notFoundTags || testWithErrors.notFoundTags.length === 0)
  ) {
    console.log("\n✅ Все артисты и теги найдены");
  }
})();