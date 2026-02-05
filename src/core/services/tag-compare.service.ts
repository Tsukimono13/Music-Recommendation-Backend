export function intersectTags(tagLists: Record<string, string[]>) {
  const map = new Map<string, number>();

  for (const tags of Object.values(tagLists)) {
    for (const tag of tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }

  return [...map.entries()]
    .filter(([, count]) => count > 1)
    .map(([tag]) => tag);
}
