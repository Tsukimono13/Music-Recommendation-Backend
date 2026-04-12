import {
  searchLastfmArtist,
  getSimilarArtists,
  getArtistTopTags,
} from "../providers/lastfm.provider";
import { lastfmTagsToSignals } from "../adapters/lastfm-tags.adapter";
import { getMusicBrainzTags } from "../providers/musicbrainz.provider";
import { adaptMusicBrainzTags } from "../adapters/musicbrainz.adapter";
import { MusicSignal } from "../models/music-signal.model";

const MB_TIMEOUT_MS = 2000;

export interface ArtistSignalsResult {
  signals: MusicSignal[];
  canonicalName: string;
}

export async function collectSignalsForArtist(
  artist: string,
  apiKeys: { lastfm: string },
): Promise<ArtistSignalsResult> {
  const resolved = await searchLastfmArtist(artist, apiKeys.lastfm);
  const canonicalName = resolved?.name ?? artist.trim();
  const mbid = resolved?.mbid ?? null;

  // MusicBrainz запускаем параллельно, но не ждём дольше MB_TIMEOUT_MS —
  // это дополнительные теги, не критичные для результата.
  // Используем canonicalName (исправленное Last.fm), а не исходный ввод.
  const mbPromise = Promise.race([
    getMusicBrainzTags(canonicalName).catch(() => [] as { name: string; count: number }[]),
    new Promise<{ name: string; count: number }[]>((resolve) =>
      setTimeout(() => resolve([]), MB_TIMEOUT_MS),
    ),
  ]);

  const [similar, lastfmTags, mbTags] = await Promise.all([
    getSimilarArtists(canonicalName, apiKeys.lastfm, { mbid }),
    getArtistTopTags(canonicalName, apiKeys.lastfm),
    mbPromise,
  ]);

  const signals: MusicSignal[] = [];

  for (const a of similar) {
    signals.push({
      source: "lastfm",
      kind: "artist",
      value: a.name,
      weight: Number(a.match),
    });
  }

  signals.push(...lastfmTagsToSignals(lastfmTags));
  signals.push(...adaptMusicBrainzTags(mbTags));

  return { signals, canonicalName };
}
