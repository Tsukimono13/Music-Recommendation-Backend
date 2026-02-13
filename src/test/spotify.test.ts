import "dotenv/config";
import {
  searchArtist,
  getArtistById,
} from "../core/providers/spotify.provider";

(async () => {
  console.log("=== SPOTIFY API TEST ===\n");

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error(
      "❌ SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env",
    );
    process.exit(1);
  }

  const testArtists = ["Metallica", "The Beatles", "Radiohead"];

  for (const artistName of testArtists) {
    console.log(`\n🎵 ${artistName}`);

    // Поиск артиста
    const artist = await searchArtist(artistName);
    if (!artist) {
      console.log("  ❌ Artist not found\n");
      continue;
    }

    console.log(`  ✅ Found: ${artist.name} (ID: ${artist.id})`);

    // Получение артиста по ID
    console.log(`\n  📋 Getting artist data by ID...`);
    try {
      const artistData = await getArtistById(artist.id);
      console.log(`  ✅ Artist data received:`);
      console.log(`     Name: ${artistData.name}`);
      console.log(`     ID: ${artistData.id}`);
      console.log(`     Spotify URL: ${artistData.external_urls?.spotify || "N/A"}`);
      console.log(`     Images: ${artistData.images?.length || 0} available`);
    } catch (err) {
      console.log(`  ❌ Failed to get artist data: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("\n✅ Test completed");
})();
