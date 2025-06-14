import { cacheService } from '../../src/services/CacheService';

describe('CacheService', () => {
  beforeEach(() => {
    cacheService.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      
      cacheService.set(key, value);
      const retrieved = cacheService.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', () => {
      const result = cacheService.get('non-existent');
      expect(result).toBeNull();
    });

    it('should overwrite existing value', () => {
      const key = 'test-key';
      const value1 = { data: 'value1' };
      const value2 = { data: 'value2' };
      
      cacheService.set(key, value1);
      cacheService.set(key, value2);
      
      expect(cacheService.get(key)).toEqual(value2);
    });
  });

  describe('get existing keys', () => {
    it('should return value for existing key', () => {
      cacheService.set('existing', 'value');
      expect(cacheService.get('existing')).toBe('value');
    });

    it('should return null for non-existent key', () => {
      expect(cacheService.get('non-existent')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove a key', () => {
      const key = 'test-key';
      cacheService.set(key, 'value');
      
      expect(cacheService.get(key)).toBe('value');
      cacheService.delete(key);
      expect(cacheService.get(key)).toBeNull();
    });

    it('should handle deleting non-existent key', () => {
      expect(() => cacheService.delete('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all keys', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      
      cacheService.clear();
      
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBeNull();
      expect(cacheService.get('key3')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Clear cache first
      cacheService.clear();
      
      // Set some values
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      
      const stats = cacheService.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(typeof stats.hitRate).toBe('number');
    });

    it('should handle empty cache', () => {
      cacheService.clear();
      const stats = cacheService.getStats();
      
      expect(stats.size).toBe(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same input', () => {
      const text = 'This is a test text';
      const key1 = cacheService.generateKey(text);
      const key2 = cacheService.generateKey(text);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cacheService.generateKey('text1');
      const key2 = cacheService.generateKey('text2');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('TTL behavior', () => {
    it('should expire entries after TTL', () => {
      // Set a value with short TTL
      cacheService.set('expire-test', 'value', 1); // 1ms TTL
      
      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cacheService.get('expire-test')).toBeNull();
          resolve();
        }, 10);
      });
    });
  });
});