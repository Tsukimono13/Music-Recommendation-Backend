import { Request, Response, NextFunction } from "express";
import { HttpError } from "../../core/utils/http-error";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const timestamp = new Date().toISOString();

  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const isOperational = err instanceof HttpError ? err.isOperational : false;

  console.error(`[${timestamp}] ERROR ${req.method} ${req.path}:`, {
    message: err.message,
    statusCode,
    isOperational,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    body: req.body,
    query: req.query,
  });

  let userMessage = err.message;
  if (statusCode === 503) {
    userMessage = "External service temporarily unavailable. Please try again later.";
  } else if (statusCode === 429) {
    userMessage = "Too many requests. Please try again later.";
  } else if (statusCode === 500 && !isOperational) {
    userMessage = "Internal server error. Please try again later.";
  }

  res.status(statusCode).json({
    error: userMessage,
    ...(process.env.NODE_ENV === "development" && {
      originalError: err.message,
      stack: err.stack,
      details: {
        path: req.path,
        method: req.method,
      },
    }),
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
