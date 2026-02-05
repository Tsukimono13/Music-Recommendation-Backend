import { QueryInput } from "../models/query-input.model";

export type QueryMode = "single" | "intersection" | "by-tags" | "artist+tags";

export function detectQueryMode(input: QueryInput): QueryMode {
  const artistCount = input.artists?.length ?? 0;
  const tagCount = input.tags?.length ?? 0;

  if (artistCount === 1 && tagCount === 0) return "single";
  if (artistCount > 1 && tagCount === 0) return "intersection";
  if (artistCount === 0 && tagCount > 0) return "by-tags";
  if (artistCount > 0 && tagCount > 0) return "artist+tags";

  throw new Error("Invalid query");
}
