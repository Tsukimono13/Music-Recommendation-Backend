function normalize(
  value: string,
  options: {
    allowApostrophe?: boolean;
    normalizeQuotes?: boolean;
    allowUnicodeLetters?: boolean;
  } = {},
): string {
  const {
    allowApostrophe = false,
    normalizeQuotes = false,
    allowUnicodeLetters = false,
  } = options;

  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  if (normalizeQuotes) {
    normalized = normalized.replace(/[''`]/g, "'");
  }

  const allowedChars = allowUnicodeLetters
    ? /[^\p{L}\p{N}\s\-']/gu
    : allowApostrophe
      ? /[^\w\s'-]/g
      : /[^\w\s-]/g;
  normalized = normalized.replace(allowedChars, "");

  return normalized;
}

export function normalizeArtistName(name: string): string {
  return normalize(name, {
    allowApostrophe: true,
    normalizeQuotes: true,
    allowUnicodeLetters: true,
  });
}

const GARBAGE_ARTIST_NAMES = new Set([
  "-", "–", "—", "zz", "co", "unknown", "various artists",
  "-1", "-2", "–1", "–2", "—1", "—2",
]);

/** Names that are only optional minus + digits (e.g. "-2", "123"). */
const ONLY_DIGITS_OR_MINUS = /^-?\d+$/;

/** Use when building result lists: exclude empty, whitespace-only, or known garbage so we never return them or call Spotify with them. */
export function isSensibleArtistName(name: string): boolean {
  const s = name?.trim();
  if (!s || s.length < 3) return false;
  const lower = s.toLowerCase();
  if (GARBAGE_ARTIST_NAMES.has(lower)) return false;
  if (ONLY_DIGITS_OR_MINUS.test(lower)) return false;
  if (/^[\s\-–—\d]+$/.test(lower)) return false;
  return true;
}

export function normalizeTag(value: string): string {
  return normalize(value, { allowApostrophe: false, normalizeQuotes: false });
}
