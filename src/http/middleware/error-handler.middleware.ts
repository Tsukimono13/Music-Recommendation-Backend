import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const timestamp = new Date().toISOString();
  let statusCode = (err as AppError).statusCode || 500;
  const isOperational = (err as AppError).isOperational || false;


  if (err.message.includes("503") || err.message.includes("Service Temporarily Unavailable")) {
    statusCode = 503;
  } else if (err.message.includes("429") || err.message.includes("Too Many Requests")) {
    statusCode = 429;
  } else if (err.message.includes("401") || err.message.includes("Unauthorized")) {
    statusCode = 401;
  } else if (err.message.includes("404") || err.message.includes("Not Found")) {
    statusCode = 404;
  }

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
