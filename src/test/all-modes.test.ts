import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  const apiKey = process.env.LASTFM_API_KEY!;
  
  console.log("\n=== SINGLE ARTIST ===");
  const singleResult = await resolveQuery(
    { artists: ["Children of Bodom"] },
    apiKey
  );
  console.log("🔥 Похоже на Children of Bodom:");
  singleResult.artists.slice(0, 10).forEach(a =>
    console.log(`🔥 ${a.artist} — ${a.score}%`)
  );
  if (singleResult.tags) {
    console.log("\nЖанры:");
    console.log(singleResult.tags.join(", "));
  }

  console.log("\n=== INTERSECTION ===");
  const intersectionResult = await resolveQuery(
    { artists: ["Green Day", "Blink-182"] },
    apiKey
  );
  console.log("🔥 Общие похожие артисты:");
  intersectionResult.artists.slice(0, 10).forEach(a =>
    console.log(`🔥 ${a.artist} — ${a.score}%`)
  );
  if (intersectionResult.tags) {
    console.log("\nЖанры:");
    console.log(intersectionResult.tags.join(", "));
  }

  console.log("\n=== BY TAGS ===");
  const tagsResult = await resolveQuery(
    { tags: ["rock", "gothic metal"] },
    apiKey
  );
  console.log("🔥 Похожие по тегам:");
  tagsResult.artists.slice(0, 10).forEach(a =>
    console.log(`🔥 ${a.artist} — ${a.score}%`)
  );

  console.log("\n=== ARTIST + TAGS ===");
  const artistTagsResult = await resolveQuery(
    { artists: ["Metallica", "Iron Maiden"], tags: ["heavy metal", "power metal"] },
    apiKey
  );
  console.log("🔥 Похожие на Metallica + Iron Maiden с тегами:");
  artistTagsResult.artists.slice(0, 10).forEach(a =>
    console.log(`🔥 ${a.artist} — ${a.score}%`)
  );
  if (artistTagsResult.tags) {
    console.log("\nЖанры:");
    console.log(artistTagsResult.tags.join(", "));
  }
})();