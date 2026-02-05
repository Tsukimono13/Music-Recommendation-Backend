import "dotenv/config";
import { collectSignalsForArtist } from "../core/services/signals.service";
import { intersectArtistSignals } from "../core/services/intersection.service";

(async () => {
  const greenDay = await collectSignalsForArtist("Green Day", {
    lastfm: process.env.LASTFM_API_KEY!,
  });

  const blink182 = await collectSignalsForArtist("Blink-182", {
    lastfm: process.env.LASTFM_API_KEY!,
  });

  const intersection = intersectArtistSignals([greenDay, blink182]);

  // Нормализация в проценты
  const maxScore = intersection[0]?.score ?? 1;
  const result = intersection.map((item) => ({
    artist: item.artist,
    score: Math.round((item.score / maxScore) * 100),
  }));

  console.log("INTERSECTION (PERCENTS):");
  console.log(result.slice(0, 10));
})();
