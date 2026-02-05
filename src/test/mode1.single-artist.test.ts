import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  const artistName = "Metallica";

  // 1️⃣ Похожие артисты в процентах
  const result = await resolveQuery(
    { artists: [artistName] },
    process.env.LASTFM_API_KEY!,
  );

  console.log(`\nПохожие на ${artistName} (SINGLE MODE, PERCENTS):\n`);

  result.artists.forEach((item) => {
    console.log(`🔥 ${item.artist} — ${item.score}%`);
  });

  // 2️⃣ Теги для информации
  if (result.tags && result.tags.length > 0) {
    console.log(`\nЖанры:\n${result.tags.join(", ")}`);
  }
})();
