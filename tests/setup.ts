import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { databaseService } from '../src/services/DatabaseService';
import { cacheService } from '../src/services/CacheService';
import { queueService } from '../src/services/QueueService';
import { analysisWorker } from '../src/workers/AnalysisWorker';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.REDIS_URL = ''; // Disable Redis for tests
  
  // Initialize services if needed
  console.log('Test setup completed');
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Close all connections
    await databaseService.disconnect();
    await queueService.close();
    cacheService.destroy();
    analysisWorker.stop();
    
    console.log('Test cleanup completed');
  } catch (error) {
    console.error('Test cleanup error:', error);
  }
});

// Clean state before each test
beforeEach(async () => {
  // Clear cache before each test
  cacheService.clear();
});

// Clean up after each test
afterEach(async () => {
  // Clean up any test data if needed
});

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toEndWith(received: string, suffix: string) {
    const pass = received.endsWith(suffix);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to end with ${suffix}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to end with ${suffix}`,
        pass: false,
      };
    }
  },
});

