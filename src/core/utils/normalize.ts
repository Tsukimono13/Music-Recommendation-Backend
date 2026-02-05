function normalize(
  value: string,
  options: { allowApostrophe?: boolean; normalizeQuotes?: boolean } = {},
): string {
  const { allowApostrophe = false, normalizeQuotes = false } = options;

  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  if (normalizeQuotes) {
    normalized = normalized.replace(/[''`]/g, "'");
  }

  const allowedChars = allowApostrophe ? /[^\w\s'-]/g : /[^\w\s-]/g;
  normalized = normalized.replace(allowedChars, "");

  return normalized;
}

export function normalizeArtistName(name: string): string {
  return normalize(name, { allowApostrophe: true, normalizeQuotes: true });
}

export function normalizeTag(value: string): string {
  return normalize(value, { allowApostrophe: false, normalizeQuotes: false });
}
