import {
  getSimilarArtists,
  getArtistTopTags,
} from "../providers/lastfm.provider";
import { lastfmTagsToSignals } from "../adapters/lastfm-tags.adapter";
import { getMusicBrainzTags } from "../providers/musicbrainz.provider";
import { adaptMusicBrainzTags } from "../adapters/musicbrainz.adapter";
import { MusicSignal } from "../models/music-signal.model";

export async function collectSignalsForArtist(
  artist: string,
  apiKeys: { lastfm: string },
): Promise<MusicSignal[]> {
  const [similar, lastfmTags] = await Promise.all([
    getSimilarArtists(artist, apiKeys.lastfm),
    getArtistTopTags(artist, apiKeys.lastfm),
  ]);

  const mbTags = await getMusicBrainzTags(artist).catch(() => {
    console.warn(`[Signals] MusicBrainz failed for ${artist}, continuing without MB tags`);
    return [];
  });

  const signals: MusicSignal[] = [];

  // 🔹 Last.fm — похожие артисты
  for (const a of similar) {
    signals.push({
      source: "lastfm",
      kind: "artist",
      value: a.name,
      weight: Number(a.match),
    });
  }

  // 🔹 Last.fm — теги
  signals.push(...lastfmTagsToSignals(lastfmTags));

  // 🔹 MusicBrainz — теги
  signals.push(...adaptMusicBrainzTags(mbTags));

  return signals;
}
