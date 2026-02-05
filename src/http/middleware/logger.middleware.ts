import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  console.log(
    `[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip || "unknown"}`,
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor =
      res.statusCode >= 500
        ? "\x1b[31m" // red
        : res.statusCode >= 400
          ? "\x1b[33m" // yellow
          : "\x1b[32m"; // green

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ` +
        `${statusColor}${res.statusCode}\x1b[0m - ${duration}ms`,
    );
  });

  next();
}
