import "dotenv/config";
import { buildRecommendations } from "../core/services/recommend.service";
import { MusicSignal } from "../core/models/music-signal.model";

function normalizeToPercent(results: { artist: string; score: number }[]) {
  if (results.length === 0) return [];
  const maxScore = results[0].score;
  return results.map((item) => ({
    artist: item.artist,
    score: Math.round((item.score / maxScore) * 100),
  }));
}

(async () => {
  const tagSignals: MusicSignal[] = [
    { kind: "tag", source: "user", value: "rock", weight: 1 },
    { kind: "tag", source: "user", value: "gothic metal", weight: 8 },
  ];

  const result = await buildRecommendations(
    tagSignals,
    process.env.LASTFM_API_KEY!,
  );

  const normalized = normalizeToPercent(result);

  console.log("TAGS ONLY (PERCENTS):");
  console.log(normalized.slice(0, 15));
})();
