import { Express, Request, Response } from "express";
import { resolveQuery } from "../core/services/resolve-query.service";
import { parseRecommendationQuery } from "../core/services/query-from-message.service";
import { asyncHandler } from "./middleware/error-handler.middleware";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";

export function registerRoutes(app: Express) {
  app.get("/health", (_, res) => {
    const spotifyConfigured =
      Boolean(process.env.SPOTIFY_CLIENT_ID) &&
      Boolean(process.env.SPOTIFY_CLIENT_SECRET);
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
    );
    res.json({
      ok: true,
      spotifyConfigured,
      geminiConfigured,
    });
  });

  app.post(
    "/api/music/recommend",
    apiRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as { artists?: string[]; tags?: string[]; message?: string };
      const lastFmKey = process.env.LASTFM_API_KEY;

      if (!lastFmKey) {
        throw new Error("LASTFM_API_KEY is not configured");
      }

      let input: { artists?: string[]; tags?: string[] };

      if (typeof body.message === "string" && body.message.trim()) {
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        if (!geminiKey) {
          throw new Error("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is required for message-based recommendations");
        }
        input = await parseRecommendationQuery(body.message.trim(), geminiKey);
        if (!input.artists?.length && !input.tags?.length) {
          return res.status(400).json({
            error: "Could not extract artists or tags from the message",
            parsed: input,
          });
        }
      } else {
        input = { artists: body.artists, tags: body.tags };
        const hasArtists = Array.isArray(input.artists) && input.artists.some((a) => typeof a === "string" && a.trim());
        const hasTags = Array.isArray(input.tags) && input.tags.some((t) => typeof t === "string" && t.trim());
        if (!hasArtists && !hasTags) {
          return res.status(400).json({
            error: "Provide either message or artists/tags",
          });
        }
      }

      const result = await resolveQuery(input, lastFmKey);
      res.json(result);
    }),
  );
}
