import rateLimit from "express-rate-limit";

export const generalRateLimiter = rateLimit({
  windowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // 100 запросов за окно
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, 
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});

export const apiRateLimiter = rateLimit({
  windowMs:
    Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: Number(process.env.API_RATE_LIMIT_MAX) || 20, // 20 запросов за окно
  message: {
    error: "Too many API requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    const timestamp = new Date().toISOString();
    console.warn(
      `[${timestamp}] RATE LIMIT EXCEEDED: ${req.method} ${req.path} - IP: ${req.ip}`,
    );
    
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.ceil((resetTime - Date.now()) / 1000)
      : 900; // 15 минут по умолчанию

    res.status(429).json({
      error: "Too many API requests from this IP, please try again later.",
      retryAfter,
    });
  },
});
