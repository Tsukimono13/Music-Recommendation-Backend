import "dotenv/config";
import { resolveQuery } from "../core/services/resolve-query.service";
import { searchArtist, getSimilarArtists } from "../core/providers/lastfm.provider";

const apiKey = process.env.LASTFM_API_KEY!;

const GARBAGE_NAMES = new Set(["-", "–", "—", "zz", "unknown", "various artists"]);
const MIN_NAME_LENGTH = 2;

function isGarbage(name: string): boolean {
  const s = name?.trim().toLowerCase();
  return !s || s.length < MIN_NAME_LENGTH || GARBAGE_NAMES.has(s);
}

async function runSingleArtistTest(artistName: string) {
  console.log(`\n--- Поиск похожих на: "${artistName}" ---\n`);

  const result = await resolveQuery({ artists: [artistName] }, apiKey);

  console.log(`Найдено артистов: ${result.artists.length}`);

  result.artists.slice(0, 12).forEach((item, idx) => {
    const spotifyInfo = item.spotifyUrl ? `✅ ${item.spotifyUrl}` : "❌ Spotify: не найден";
    console.log(`  ${idx + 1}. ${item.artist} — ${item.score}%  ${spotifyInfo}`);
  });

  if (result.tags?.length) {
    console.log(`\nТеги: ${result.tags.slice(0, 8).join(", ")}`);
  }

  const garbage = result.artists.filter((a) => isGarbage(a.artist));
  if (garbage.length > 0) {
    throw new Error(`В списке есть мусор: ${garbage.map((a) => JSON.stringify(a.artist)).join(", ")}`);
  }
  console.log(`\n✅ Мусорных артистов в списке нет.`);
  return result;
}

(async () => {
  if (!apiKey) {
    console.error("LASTFM_API_KEY не задан.");
    process.exit(1);
  }

  console.log("\n=== MODE 1: SINGLE ARTIST (проверка разрешения артиста + фильтр мусора) ===\n");

  // 1) Проверка разрешения артиста: "Ария" -> каноническое имя + MBID, похожие как на сайте
  console.log("1️⃣ Ария (кириллица) — ожидаем Кипелов, Эпидемия и т.п., без «-», «Zz»");
  const resolved = await searchArtist("Ария", apiKey);
  if (!resolved) throw new Error("searchArtist('Ария') не вернул артиста");
  console.log(`   Разрешённый артист: "${resolved.name}", mbid: ${resolved.mbid ?? "—"}`);

  const similarRaw = await getSimilarArtists(resolved.name, apiKey, { mbid: resolved.mbid });
  console.log(`   Похожих от Last.fm (после фильтра): ${similarRaw.length}`);
  similarRaw.slice(0, 6).forEach((a: { name: string; match?: number }, i: number) => {
    console.log(`   ${i + 1}. ${a.name} (match: ${a.match ?? "—"})`);
  });

  const resultAria = await runSingleArtistTest("Ария");
  const names = resultAria.artists.map((a) => a.artist.toLowerCase());
  const expectedHints = ["кипелов", "эпидемия", "наутилус", "мастер", "черный кофе", "крематорий"];
  const found = expectedHints.filter((h) => names.some((n) => n.includes(h)));
  if (found.length >= 1) {
    console.log(`   Ожидаемые похожие (найдены): ${found.join(", ")}`);
  }

  // 2) Латинское "Aria" — должен разрешиться в ту же группу
  console.log("\n2️⃣ Aria (латиница) — тот же артист, без мусора");
  await runSingleArtistTest("Aria");

  // 3) Metallica — базовая проверка
  console.log("\n3️⃣ Metallica — базовая проверка");
  await runSingleArtistTest("Metallica");

  console.log("\n=== Все проверки пройдены ===\n");
})();
