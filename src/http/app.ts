import express from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { requestLogger } from "./middleware/logger.middleware";
import { errorHandler } from "./middleware/error-handler.middleware";
import { generalRateLimiter, apiRateLimiter } from "./middleware/rate-limit.middleware";

export function createApp() {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  app.use(cors());

  app.use(express.json({ limit: "10mb" }));

  app.use(generalRateLimiter);

  app.use(requestLogger);

  registerRoutes(app);

  app.use(errorHandler);

  return app;
}
