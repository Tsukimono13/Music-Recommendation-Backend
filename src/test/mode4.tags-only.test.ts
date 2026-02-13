import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  console.log("\n=== TAGS ONLY MODE TEST ===");
  console.log("Теги: rock, gothic metal\n");

  const result = await resolveQuery(
    {
      tags: ["rock", "gothic metal"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Найдено артистов: ${result.artists.length}\n`);

  result.artists.slice(0, 15).forEach((item, idx) => {
    const spotifyInfo = item.spotifyUrl 
      ? `✅ Spotify: ${item.spotifyUrl}` 
      : `❌ Spotify: не найден`;
    console.log(`${idx + 1}. ${item.artist} — ${item.score}%`);
    console.log(`   ${spotifyInfo}`);
  });

  // Статистика
  const withSpotify = result.artists.filter(a => a.spotifyUrl).length;
  console.log(`\n📊 Статистика:`);
  console.log(`   Всего артистов: ${result.artists.length}`);
  console.log(`   С Spotify ссылкой: ${withSpotify}`);
  console.log(`   Без Spotify ссылки: ${result.artists.length - withSpotify}`);
})();
