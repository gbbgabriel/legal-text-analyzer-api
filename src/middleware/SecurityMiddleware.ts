import helmet from 'helmet';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

interface SecurityContext {
  ip: string | undefined;
  userAgent: string | undefined;
  origin: string | undefined;
  referer: string | undefined;
  timestamp: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    securityContext?: SecurityContext;
    hasApiKey?: boolean;
  }
}

/**
 * Security headers configuration
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Disable CSP for Swagger UI compatibility
  crossOriginEmbedderPolicy: false, // Disabled for API
  hsts: false, // Disable HSTS for HTTP development
});

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
  ],
  exposedHeaders: [
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
  ],
};

/**
 * Request size limiting middleware
 */
export function requestSizeLimit(req: Request, res: Response, next: NextFunction): void {
  const contentLength = req.get('Content-Length');
  
  if (contentLength) {
    const sizeInBytes = parseInt(contentLength, 10);
    const maxSize = parseInt(config.security.requestSizeLimit.replace('mb', '')) * 1024 * 1024;
    
    if (sizeInBytes > maxSize) {
      res.status(413).json({
        success: false,
        error: 'Requisição muito grande',
        code: 'REQUEST_TOO_LARGE',
        details: {
          maxSize: config.security.requestSizeLimit,
          receivedSize: `${Math.round(sizeInBytes / 1024 / 1024)}MB`,
        },
        timestamp: new Date().toISOString(),
        requestId: 'size-limit',
      });
      return;
    }
  }
  
  next();
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body) as typeof req.body;
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as typeof req.query;
  }
  
  next();
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeValue(key) as string;
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  
  return sanitized;
}

/**
 * Sanitize individual value
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remove potentially dangerous characters
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove on* event handlers
    .trim();
}

/**
 * Add security-related request metadata
 */
export function addSecurityContext(req: Request, _res: Response, next: NextFunction): void {
  // Add request metadata for logging
  req.securityContext = {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString(),
  };
  
  next();
}

/**
 * Compression middleware
 */
export const compressionMiddleware = compression({
  filter: (req: Request, _res: Response) => {
    // Don't compress responses if the request includes a 'x-no-compression' header
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Fall back to standard filter function
    return compression.filter(req, _res);
  },
  level: 6, // Default compression level
  threshold: 1024, // Only compress responses > 1KB
});

/**
 * API Key validation middleware (optional)
 */
export function validateApiKey(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.get('X-API-Key');
  
  // For now, just log the API key presence
  // In a real application, you would validate against a database
  if (apiKey) {
    req.hasApiKey = true;
  }
  
  next();
}