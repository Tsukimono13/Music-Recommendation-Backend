import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  const artistName = "Metallica";

  console.log(`\n=== SINGLE ARTIST MODE TEST ===`);
  console.log(`Поиск похожих на: ${artistName}\n`);

  // 1️⃣ Похожие артисты в процентах с Spotify ссылками
  const result = await resolveQuery(
    { artists: [artistName] },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`Найдено артистов: ${result.artists.length}\n`);

  result.artists.slice(0, 10).forEach((item, idx) => {
    const spotifyInfo = item.spotifyUrl 
      ? `✅ Spotify: ${item.spotifyUrl}` 
      : `❌ Spotify: не найден`;
    console.log(`${idx + 1}. ${item.artist} — ${item.score}%`);
    console.log(`   ${spotifyInfo}`);
  });

  // 2️⃣ Теги для информации
  if (result.tags && result.tags.length > 0) {
    console.log(`\n📋 Жанры:\n${result.tags.slice(0, 10).join(", ")}`);
  }

  // Статистика по Spotify ссылкам
  const withSpotify = result.artists.filter(a => a.spotifyUrl).length;
  console.log(`\n📊 Статистика:`);
  console.log(`   Всего артистов: ${result.artists.length}`);
  console.log(`   С Spotify ссылкой: ${withSpotify}`);
  console.log(`   Без Spotify ссылки: ${result.artists.length - withSpotify}`);
})();
