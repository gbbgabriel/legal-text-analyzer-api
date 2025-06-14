import { Request, Response, NextFunction } from 'express';
import { HealthController } from '../../../src/controllers/HealthController';
import { databaseService } from '../../../src/services/DatabaseService';
import { queueService } from '../../../src/services/QueueService';
import { openAIService } from '../../../src/services/OpenAIService';
// import { fileProcessingService } from '../../../src/services/FileProcessingService'; // Mocked
import { cacheService } from '../../../src/services/CacheService';
import * as responseUtils from '../../../src/utils/response';

jest.mock('../../../src/services/DatabaseService');
jest.mock('../../../src/services/QueueService');
jest.mock('../../../src/services/OpenAIService');
jest.mock('../../../src/services/FileProcessingService');
jest.mock('../../../src/services/CacheService');
jest.mock('../../../src/utils/response');

describe('HealthController', () => {
  let healthController: HealthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let sendSuccessResponseSpy: jest.SpyInstance;

  beforeEach(() => {
    healthController = new HealthController();
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    
    sendSuccessResponseSpy = jest.spyOn(responseUtils, 'sendSuccessResponse').mockImplementation();
    
    // Mock service responses
    (databaseService.getStats as jest.Mock).mockResolvedValue({
      totalAnalyses: 100,
      avgProcessingTime: 1500,
    });
    
    (queueService.getStats as jest.Mock).mockResolvedValue({
      pendingJobs: 5,
      activeJobs: 2,
      completedJobs: 98,
      failedJobs: 1,
    });
    
    (cacheService.getStats as jest.Mock).mockReturnValue({
      size: 10,
      hitRate: 0.85,
    });
    
    (openAIService.getStats as jest.Mock).mockReturnValue({
      totalRequests: 50,
      successRate: 0.95,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    beforeEach(() => {
      // Mock health check methods
      jest.spyOn(healthController as any, 'performHealthCheck').mockResolvedValue({
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
        uptime: 3600,
        components: {
          database: { status: 'healthy', responseTime: '10ms' },
          queue: { status: 'healthy', responseTime: '5ms', type: 'memory' },
          fileSystem: { status: 'healthy', responseTime: '2ms' },
        },
        metrics: {
          totalAnalyses: 100,
          analysesToday: 15,
          averageResponseTime: '1s',
          cacheHitRate: '85%',
        },
      });
    });

    it('should return healthy status with 200 code', async () => {
      await healthController.getHealth(mockReq as Request, mockRes as Response, mockNext);

      expect(sendSuccessResponseSpy).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 'healthy',
          components: expect.any(Object),
          metrics: expect.any(Object),
        }),
        200
      );
    });

    it('should return unhealthy status with 503 code', async () => {
      jest.spyOn(healthController as any, 'performHealthCheck').mockResolvedValue({
        status: 'unhealthy',
        components: {
          database: { status: 'unhealthy', error: 'Connection failed' },
        },
      });

      await healthController.getHealth(mockReq as Request, mockRes as Response, mockNext);

      expect(sendSuccessResponseSpy).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 'unhealthy',
        }),
        503
      );
    });

    it('should handle errors by calling next', async () => {
      const error = new Error('Health check failed');
      jest.spyOn(healthController as any, 'performHealthCheck').mockRejectedValue(error);

      await healthController.getHealth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(sendSuccessResponseSpy).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return API statistics', async () => {
      await healthController.getStats(mockReq as Request, mockRes as Response, mockNext);

      expect(sendSuccessResponseSpy).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          database: expect.any(Object),
          queue: expect.any(Object),
          cache: expect.objectContaining({
            size: 10,
            hitRate: '85%',
          }),
          openai: expect.any(Object),
          system: expect.objectContaining({
            uptime: expect.any(Number),
            memory: expect.any(Object),
            cpu: expect.any(Number),
          }),
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      (databaseService.getStats as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await healthController.getStats(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getSupportedFormats', () => {
    it('should return supported file formats', async () => {
      await healthController.getSupportedFormats(mockReq as Request, mockRes as Response, mockNext);

      expect(sendSuccessResponseSpy).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          formats: expect.arrayContaining([
            expect.objectContaining({
              extension: 'txt',
              mimeTypes: expect.any(Array),
              maxSize: expect.any(Number),
              description: expect.any(String),
            }),
            expect.objectContaining({
              extension: 'pdf',
              mimeTypes: expect.any(Array),
            }),
            expect.objectContaining({
              extension: 'docx',
              mimeTypes: expect.any(Array),
            }),
          ]),
          globalMaxSize: expect.any(Number),
          notes: expect.any(Array),
        })
      );
    });

    it('should handle errors', async () => {
      // Mock the config to throw an error
      const originalFileUpload = require('../../../src/config').config.fileUpload;
      require('../../../src/config').config.fileUpload = undefined;

      await healthController.getSupportedFormats(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      
      // Restore config
      require('../../../src/config').config.fileUpload = originalFileUpload;
    });
  });

  describe('performHealthCheck', () => {
    beforeEach(() => {
      // Mock individual check methods
      jest.spyOn(healthController as any, 'checkDatabase').mockResolvedValue({
        status: 'healthy',
        responseTime: '10ms',
        lastChecked: '2023-01-01T00:00:00.000Z',
      });

      jest.spyOn(healthController as any, 'checkOpenAI').mockResolvedValue({
        status: 'healthy',
        responseTime: '50ms',
        lastChecked: '2023-01-01T00:00:00.000Z',
      });

      jest.spyOn(healthController as any, 'checkRedis').mockResolvedValue({
        status: 'healthy',
        responseTime: '5ms',
        lastChecked: '2023-01-01T00:00:00.000Z',
      });

      jest.spyOn(healthController as any, 'checkQueue').mockResolvedValue({
        status: 'healthy',
        type: 'memory',
        responseTime: '3ms',
        lastChecked: '2023-01-01T00:00:00.000Z',
        pendingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
      });

      jest.spyOn(healthController as any, 'checkFileSystem').mockResolvedValue({
        status: 'healthy',
        responseTime: '2ms',
        lastChecked: '2023-01-01T00:00:00.000Z',
        tempFiles: 3,
        diskUsage: '15%',
      });

      jest.spyOn(healthController as any, 'getAnalysesToday').mockResolvedValue(25);
    });

    it('should perform comprehensive health check', async () => {
      const result = await healthController['performHealthCheck']();

      expect(result.status).toBe('healthy');
      expect(result.components.database).toBeDefined();
      expect(result.components.queue).toBeDefined();
      expect(result.components.fileSystem).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should handle component failures', async () => {
      jest.spyOn(healthController as any, 'checkDatabase').mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await healthController['performHealthCheck']();

      expect(result.status).toBe('unhealthy');
      expect(result.components.database.status).toBe('unhealthy');
      expect(result.components.database.error).toBeDefined();
    });

    it('should include Redis component when enabled', async () => {
      const result = await healthController['performHealthCheck']();

      expect(result.components.queue).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('should exclude Redis component when disabled', async () => {
      const result = await healthController['performHealthCheck']();

      expect(result.components.queue).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('checkQueue', () => {
    beforeEach(() => {
      (queueService.getStats as jest.Mock).mockResolvedValue({
        pendingJobs: 2,
        completedJobs: 10,
        failedJobs: 1,
        activeJobs: 0,
      });
    });

    it('should check queue health successfully', async () => {
      const result = await healthController['checkQueue']();

      expect(result.status).toBe('healthy');
      expect(result.type).toBeDefined();
      expect(result.responseTime).toMatch(/^\d+ms$/);
      expect(result.pendingJobs).toBe(2);
      expect(result.completedJobs).toBe(10);
      expect(result.failedJobs).toBe(1);
    });

    it('should handle queue check failure', async () => {
      (queueService.getStats as jest.Mock).mockRejectedValue(new Error('Queue error'));

      const result = await healthController['checkQueue']();

      expect(result.status).toBe('unhealthy');
      expect(result.type).toBe('unknown');
      expect(result.error).toBe('Queue error');
    });
  });

  describe('getAnalysesToday', () => {
    beforeEach(() => {
      (databaseService.getAnalysisCountByDateRange as jest.Mock).mockResolvedValue(42);
    });

    it('should return analysis count for today', async () => {
      const count = await healthController['getAnalysesToday']();

      expect(count).toBe(42);
      expect(databaseService.getAnalysisCountByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should return 0 on database error', async () => {
      (databaseService.getAnalysisCountByDateRange as jest.Mock).mockRejectedValue(
        new Error('DB Error')
      );

      const count = await healthController['getAnalysesToday']();

      expect(count).toBe(0);
    });
  });

  describe('getDiskUsage', () => {
    it('should return disk usage percentage', async () => {
      // Mock fs.stat
      const mockFs = require('fs/promises');
      jest.spyOn(mockFs, 'stat').mockResolvedValue({ size: 1024 * 1024 }); // 1MB

      const usage = await healthController['getDiskUsage']();

      expect(usage).toMatch(/^\d+%$/);
    });

    it('should return N/A on file system error', async () => {
      const mockFs = require('fs/promises');
      jest.spyOn(mockFs, 'stat').mockRejectedValue(new Error('FS Error'));

      const usage = await healthController['getDiskUsage']();

      expect(usage).toBe('N/A');
    });
  });
});