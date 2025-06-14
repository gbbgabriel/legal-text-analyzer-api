import path from 'path';
import { createHash } from 'crypto';

/**
 * Sanitize file path to prevent directory traversal attacks
 */
export function sanitizeFilePath(filename: string): string {
  // Remove any directory traversal attempts
  const basename = path.basename(filename);
  
  // Replace any non-alphanumeric characters except dots and hyphens
  return basename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Validate file path is within allowed directory
 */
export function isPathSafe(filePath: string, allowedDir: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  return resolvedPath.startsWith(resolvedAllowedDir);
}

/**
 * Generate secure hash for caching
 */
export function generateSecureHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // API key should be alphanumeric with hyphens, 32-128 chars
  const apiKeyRegex = /^[a-zA-Z0-9-]{32,128}$/;
  return apiKeyRegex.test(apiKey);
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string): string {
  if (!data || data.length < 8) return '***';
  
  const visibleChars = 4;
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  
  return `${start}...${end}`;
}