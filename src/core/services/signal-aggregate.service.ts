import { MusicSignal } from "../models/music-signal.model";
import { normalizeArtistName, normalizeTag } from "../utils/normalize";

export interface AggregatedSignals {
  artists: Map<string, number>;
  tags: Map<string, number>;
}

export function aggregateSignals(
  signals: MusicSignal[],
): AggregatedSignals {
  const artists = new Map<string, number>();
  const tags = new Map<string, number>();

  for (const s of signals) {
    if (s.source === "lastfm") {
      const key = normalizeArtistName(s.value);
      artists.set(key, (artists.get(key) || 0) + s.weight);
    }

    if (s.source === "musicbrainz") {
      const key = normalizeTag(s.value);
      tags.set(key, (tags.get(key) || 0) + s.weight);
    }
  }

  return { artists, tags };
}