import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";

(async () => {
  const apiKey = process.env.LASTFM_API_KEY!;

  console.log("\n" + "=".repeat(60));
  console.log("=== SINGLE ARTIST ===");
  console.log("=".repeat(60));
  const singleResult = await resolveQuery(
    { artists: ["Children of Bodom"] },
    apiKey,
  );
  console.log("🔥 Похоже на Children of Bodom:");
  singleResult.artists.slice(0, 10).forEach((a, idx) => {
    const spotifyInfo = a.spotifyUrl
      ? `✅ ${a.spotifyUrl}`
      : `❌ Spotify не найден`;
    console.log(`${idx + 1}. ${a.artist} — ${a.score}%`);
    console.log(`   ${spotifyInfo}`);
  });
  if (singleResult.tags) {
    console.log("\n📋 Жанры:");
    console.log(singleResult.tags.slice(0, 10).join(", "));
  }
  const singleSpotify = singleResult.artists.filter((a) => a.spotifyUrl).length;
  console.log(
    `\n📊 С Spotify: ${singleSpotify}/${singleResult.artists.length}`,
  );

  console.log("\n" + "=".repeat(60));
  console.log("=== INTERSECTION ===");
  console.log("=".repeat(60));
  const intersectionResult = await resolveQuery(
    { artists: ["Green Day", "Blink-182"] },
    apiKey,
  );
  console.log("🔥 Общие похожие артисты:");
  intersectionResult.artists.slice(0, 10).forEach((a, idx) => {
    const spotifyInfo = a.spotifyUrl
      ? `✅ ${a.spotifyUrl}`
      : `❌ Spotify не найден`;
    console.log(`${idx + 1}. ${a.artist} — ${a.score}%`);
    console.log(`   ${spotifyInfo}`);
  });
  if (
    intersectionResult.fallbackArtists &&
    intersectionResult.fallbackArtists.length > 0
  ) {
    console.log("\n📋 Fallback артисты:");
    intersectionResult.fallbackArtists.slice(0, 5).forEach((a, idx) => {
      const spotifyInfo = a.spotifyUrl
        ? `✅ ${a.spotifyUrl}`
        : `❌ Spotify не найден`;
      console.log(`${idx + 1}. ${a.artist} — ${a.score}%`);
      console.log(`   ${spotifyInfo}`);
    });
  }
  if (intersectionResult.tags) {
    console.log("\n📋 Жанры:");
    console.log(intersectionResult.tags.slice(0, 10).join(", "));
  }
  const intersectionSpotify = intersectionResult.artists.filter(
    (a) => a.spotifyUrl,
  ).length;
  console.log(
    `\n📊 С Spotify: ${intersectionSpotify}/${intersectionResult.artists.length}`,
  );

  console.log("\n" + "=".repeat(60));
  console.log("=== BY TAGS ===");
  console.log("=".repeat(60));
  const tagsResult = await resolveQuery(
    { tags: ["rock", "gothic metal"] },
    apiKey,
  );
  console.log("🔥 Похожие по тегам:");
  tagsResult.artists.slice(0, 10).forEach((a, idx) => {
    const spotifyInfo = a.spotifyUrl
      ? `✅ ${a.spotifyUrl}`
      : `❌ Spotify не найден`;
    console.log(`${idx + 1}. ${a.artist} — ${a.score}%`);
    console.log(`   ${spotifyInfo}`);
  });
  const tagsSpotify = tagsResult.artists.filter((a) => a.spotifyUrl).length;
  console.log(`\n📊 С Spotify: ${tagsSpotify}/${tagsResult.artists.length}`);

  console.log("\n" + "=".repeat(60));
  console.log("=== ARTIST + TAGS ===");
  console.log("=".repeat(60));
  const artistTagsResult = await resolveQuery(
    {
      artists: ["Metallica", "Iron Maiden"],
      tags: ["heavy metal", "power metal"],
    },
    apiKey,
  );
  console.log("🔥 Похожие на Metallica + Iron Maiden с тегами:");
  artistTagsResult.artists.slice(0, 10).forEach((a, idx) => {
    const spotifyInfo = a.spotifyUrl
      ? `✅ ${a.spotifyUrl}`
      : `❌ Spotify не найден`;
    console.log(`${idx + 1}. ${a.artist} — ${a.score}%`);
    console.log(`   ${spotifyInfo}`);
  });
  if (artistTagsResult.tags) {
    console.log("\n📋 Жанры:");
    console.log(artistTagsResult.tags.slice(0, 10).join(", "));
  }
  if (
    artistTagsResult.notFoundArtists &&
    artistTagsResult.notFoundArtists.length > 0
  ) {
    console.log("\n⚠️  Не найденные артисты:");
    artistTagsResult.notFoundArtists.forEach((artist) => {
      console.log(`   - ${artist}`);
    });
  }

  if (
    artistTagsResult.notFoundTags &&
    artistTagsResult.notFoundTags.length > 0
  ) {
    console.log("\n⚠️  Не найденные теги:");
    artistTagsResult.notFoundTags.forEach((tag) => {
      console.log(`   - ${tag}`);
    });
  }
  const artistTagsSpotify = artistTagsResult.artists.filter(
    (a) => a.spotifyUrl,
  ).length;
  console.log(
    `\n📊 С Spotify: ${artistTagsSpotify}/${artistTagsResult.artists.length}`,
  );

  console.log("\n" + "=".repeat(60));
  console.log("✅ Все тесты завершены!");
  console.log("=".repeat(60));
})();
