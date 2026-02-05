import { MusicSignal } from "../models/music-signal.model";
import { normalizeTag } from "../utils/normalize";
import { MusicBrainzTag } from "../providers/musicbrainz.provider";

export function adaptMusicBrainzTags(tags: MusicBrainzTag[]): MusicSignal[] {
  return tags.map((tag) => ({
    kind: "tag",
    source: "musicbrainz",
    value: normalizeTag(tag.name),
    weight: tag.count || 1,
  }));
}
