import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  const result = await resolveQuery(
    {
      artists: ["Metallica", "Iron Maiden", "Led Zeppelin"],
      tags: ["heavy metal", "classic rock", "rock"],
    },
    process.env.LASTFM_API_KEY!,
  );

  console.log("ARTIST + TAGS MODE (PERCENTS, NO DUPLICATES):");

  // Красивый вывод
  result.artists.slice(0, 10).forEach((item) => {
    console.log(`🔥 ${item.artist} — ${item.score}%`);
  });

  if (result.tags && result.tags.length > 0) {
    console.log("\nТеги (информация, не для подсчета):");
    console.log(result.tags.join(", "));
  }
})();