import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config';
import { ErrorCode } from '../types';

/**
 * Custom rate limit message
 */
const rateLimitMessage = (_req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    details: {
      limit: config.rateLimit.max,
      windowMs: config.rateLimit.windowMs,
      resetTime: new Date(Date.now() + config.rateLimit.windowMs).toISOString(),
    },
    timestamp: new Date().toISOString(),
    requestId: 'rate-limit',
  });
};

/**
 * General rate limiter for most endpoints
 */
export const generalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.max, // 100 requests per window
  message: rateLimitMessage,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: rateLimitMessage,
});

/**
 * Stricter rate limiter for analysis endpoints
 */
export const analysisRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: Math.floor(config.rateLimit.max * 0.5), // 50 requests per window
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage,
  keyGenerator: (req: Request): string => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * Very strict rate limiter for file upload endpoints
 */
export const fileUploadRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: Math.floor(config.rateLimit.max * 0.2), // 20 requests per window
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage,
  keyGenerator: (req: Request): string => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * Lenient rate limiter for status/health endpoints
 */
export const statusRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.max * 2, // 200 requests per window
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage,
});