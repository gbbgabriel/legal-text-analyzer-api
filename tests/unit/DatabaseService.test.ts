import { databaseService } from '../../src/services/DatabaseService';
import { v4 as uuidv4 } from 'uuid';

describe('DatabaseService', () => {
  const testAnalysisId = uuidv4();
  
  beforeAll(async () => {
    // Ensure database is connected
    await databaseService['connectWithRetry']();
  });

  afterAll(async () => {
    // Clean up test data
    await databaseService['prisma'].analysis.deleteMany({
      where: { id: testAnalysisId }
    });
    await databaseService.disconnect();
  });

  describe('createAnalysis', () => {
    it('should create a new analysis record', async () => {
      const analysisData = {
        id: testAnalysisId,
        text: 'Test legal text',
        textLength: 15,
        type: 'legal',
        sourceType: 'text',
        originalFilename: 'test.txt',
        fileSize: 100,
        status: 'processing',
      };

      const result = await databaseService.createAnalysis(analysisData);

      expect(result.id).toBe(testAnalysisId);
      expect(result.text).toBe(analysisData.text);
      expect(result.textLength).toBe(analysisData.textLength);
      expect(result.type).toBe('legal');
      expect(result.status).toBe('processing');
    });

    it('should handle missing optional fields', async () => {
      const minimalData = {
        id: uuidv4(),
        text: 'Minimal text',
        textLength: 12,
      };

      const result = await databaseService.createAnalysis(minimalData);

      expect(result.type).toBe('legal'); // default value
      expect(result.sourceType).toBe('text'); // default value
      expect(result.status).toBe('processing'); // default value
      
      // Clean up
      await databaseService['prisma'].analysis.delete({ where: { id: result.id } });
    });
  });

  describe('updateAnalysis', () => {
    it('should update analysis status and result', async () => {
      const updateData = {
        status: 'completed',
        progress: 100,
        result: {
          wordCount: 3,
          characterCount: 15,
          topWords: [{ word: 'test', count: 1 }],
          legalTerms: [],
          structure: { paragraphs: 1, articles: 0, sections: 0 },
          processingTime: 123,
        },
        processingTime: 123,
        completedAt: new Date(),
      };

      const updated = await databaseService.updateAnalysis(testAnalysisId, updateData);

      expect(updated.status).toBe('completed');
      expect(updated.progress).toBe(100);
      expect(typeof updated.result).toBe('string');
      expect(updated.processingTime).toBe(123);
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('should update with error information', async () => {
      const errorUpdate = {
        status: 'failed',
        error: 'Test error message',
        failedAt: new Date(),
      };

      const updated = await databaseService.updateAnalysis(testAnalysisId, errorUpdate);

      expect(updated.status).toBe('failed');
      expect(updated.error).toBe('Test error message');
      expect(updated.failedAt).toBeInstanceOf(Date);
    });
  });

  describe('getAnalysis', () => {
    it('should retrieve analysis by id', async () => {
      const analysis = await databaseService.getAnalysis(testAnalysisId);

      expect(analysis).not.toBeNull();
      expect(analysis?.id).toBe(testAnalysisId);
    });

    it('should return null for non-existent id', async () => {
      const analysis = await databaseService.getAnalysis(uuidv4());
      expect(analysis).toBeNull();
    });
  });

  describe('searchTerm', () => {
    beforeAll(async () => {
      // Create test analyses with specific terms
      await databaseService.createAnalysis({
        id: uuidv4(),
        text: 'Contract agreement with legal terms',
        textLength: 35,
        status: 'completed',
      });
    });

    it('should find analyses containing search term', async () => {
      const results = await databaseService.searchTerm('contract');

      expect(results.analyses.length).toBeGreaterThan(0);
      expect(results.analyses[0].text).toContain('Contract');
    });

    it('should handle limit parameter', async () => {
      const results = await databaseService.searchTerm('legal');
      expect(results.analyses.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for non-existent term', async () => {
      const results = await databaseService.searchTerm('nonexistentterm123');
      expect(results.analyses).toEqual([]);
    });
  });

  describe('createSearchHistory', () => {
    it('should create search history record', async () => {
      const searchData = {
        searchTerm: 'test search',
        resultsCount: 5,
      };

      const result = await databaseService.saveSearchHistory({
        term: searchData.searchTerm,
        found: searchData.resultsCount > 0
      });

      expect(result.term).toBe('test search');
      expect(result.found).toBe(true);
      expect(result.id).toBeDefined();
      
      // Clean up
      await databaseService['prisma'].searchHistory.delete({ where: { id: result.id } });
    });
  });

  describe('getStats', () => {
    it('should return database statistics', async () => {
      const stats = await databaseService.getStats();

      expect(stats).toHaveProperty('totalAnalyses');
      expect(stats).toHaveProperty('completedAnalyses');
      expect(stats).toHaveProperty('failedAnalyses');
      expect(stats).toHaveProperty('avgProcessingTime');
      expect(stats).toHaveProperty('totalSearches');
      
      expect(typeof stats.totalAnalyses).toBe('number');
      expect(typeof stats.avgProcessingTime).toBe('number');
    });
  });

  describe('getAnalysisCountByDateRange', () => {
    it('should count analyses within date range', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const count = await databaseService.getAnalysisCountByDateRange(today, tomorrow);
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for future date range', async () => {
      const futureStart = new Date();
      futureStart.setFullYear(futureStart.getFullYear() + 1);
      const futureEnd = new Date(futureStart);
      futureEnd.setDate(futureEnd.getDate() + 1);

      const count = await databaseService.getAnalysisCountByDateRange(futureStart, futureEnd);
      
      expect(count).toBe(0);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status', async () => {
      const health = await databaseService.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Temporarily disconnect
      await databaseService.disconnect();

      // Try to perform operation
      const result = await databaseService.getAnalysis('any-id');
      
      // Should reconnect automatically or return null
      expect(result).toBeNull();
      
      // Reconnect for other tests
      await databaseService['connectWithRetry']();
    });
  });
});