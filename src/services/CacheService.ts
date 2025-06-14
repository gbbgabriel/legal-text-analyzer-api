import { createHash } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<unknown>>;
  private cleanupInterval: NodeJS.Timeout;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    this.cache = new Map();
    
    // Setup cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      config.cache.checkPeriod
    );
  }

  /**
   * Generate cache key from text using SHA-256 hash
   */
  generateKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    logger.debug(`Cache hit for key: ${key.substring(0, 8)}...`);
    return entry.data as T;
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || config.cache.ttl);
    
    this.cache.set(key, {
      data: value,
      expiresAt,
    });
    
    logger.debug(`Cache set for key: ${key.substring(0, 8)}...`);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    memoryUsage: number;
    hitRate: number;
  } {
    const size = this.cache.size;
    const memoryUsage = process.memoryUsage().heapUsed;
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    return {
      size,
      memoryUsage,
      hitRate,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Destroy cache service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Export singleton instance
export const cacheService = new CacheService();