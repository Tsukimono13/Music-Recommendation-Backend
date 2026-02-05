import { MusicSignal } from "../models/music-signal.model";
import { normalizeTag } from "../utils/normalize";

export function lastfmTagsToSignals(
  tags: { name: string; count: number }[],
): MusicSignal[] {
  return tags.map((tag) => ({
    kind: "tag",
    source: "lastfm",
    value: normalizeTag(tag.name),
    weight: tag.count,
  }));
}
