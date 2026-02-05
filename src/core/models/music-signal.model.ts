export type SignalKind = "artist" | "tag";
export type MusicSignalSource = "lastfm" | "musicbrainz" | "user";

export interface MusicSignal {
  source: MusicSignalSource;
  kind: SignalKind;
  value: string;
  weight: number;
}
