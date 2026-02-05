import { Express, Request, Response } from "express";
import { resolveQuery } from "../core/services/resolve-query.service";
import { asyncHandler } from "./middleware/error-handler.middleware";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";

export function registerRoutes(app: Express) {
  app.get("/health", (_, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/music/recommend",
    apiRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const input = req.body; // { artists?: string[], tags?: string[] }
      const apiKey = process.env.LASTFM_API_KEY;

      if (!apiKey) {
        throw new Error("LASTFM_API_KEY is not configured");
      }

      const result = await resolveQuery(input, apiKey);
      res.json(result);
    }),
  );
}
