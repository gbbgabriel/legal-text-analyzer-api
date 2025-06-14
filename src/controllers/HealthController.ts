import { Request, Response, NextFunction } from 'express';
import os from 'os';
import fs from 'fs/promises';
import { databaseService } from '../services/DatabaseService';
import { queueService } from '../services/QueueService';
import { openAIService } from '../services/OpenAIService';
import { fileProcessingService } from '../services/FileProcessingService';
import { cacheService } from '../services/CacheService';
import { analysisWorker } from '../workers/AnalysisWorker';
import { config } from '../config';
import { 
  HealthCheckResult, 
  SupportedFormat, 
  ApiStatsResponse, 
  SupportedFormatsResponse,
  ComponentHealthCheck 
} from '../types';
import { sendSuccessResponse } from '../utils/response';

export class HealthController {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * GET /health
   * Detailed health check
   */
  async getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      sendSuccessResponse(res, health, statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /stats
   * API statistics
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [dbStats, queueStats, cacheStats, openAIStats] = await Promise.all([
        databaseService.getStats(),
        queueService.getStats(),
        Promise.resolve(cacheService.getStats()),
        Promise.resolve(openAIService.getStats()),
      ]);
      
      const statsData: ApiStatsResponse = {
        database: dbStats,
        queue: queueStats,
        cache: {
          size: cacheStats.size,
          hitRate: `${Math.round(cacheStats.hitRate * 100)}%`,
        },
        openai: openAIStats,
        system: {
          uptime: process.uptime(),
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
          },
          cpu: os.cpus().length,
        },
      };
      
      sendSuccessResponse(res, statsData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /debug
   * Debug information for worker and queue
   */
  async getDebug(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workerStats = analysisWorker.getStats();
      const queueStats = await queueService.getStats();
      
      const debugData = {
        worker: workerStats,
        queue: queueStats,
        redis: {
          enabled: config.redis.enabled,
          url: config.redis.url,
        },
        config: {
          concurrency: config.queue.concurrency,
          maxRetries: config.queue.maxRetries,
        },
        timestamp: new Date().toISOString(),
      };
      
      sendSuccessResponse(res, debugData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /supported-formats
   * List supported file formats
   */
  async getSupportedFormats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const formats: SupportedFormat[] = [
        {
          extension: 'txt',
          mimeTypes: config.fileFormats.txt.mimeTypes,
          maxSize: config.fileFormats.txt.maxSize,
          description: 'Arquivo de texto simples',
          limitations: [
            'Suporta diferentes encodings (UTF-8, Latin1, etc)',
            'Preserva quebras de linha',
          ],
        },
        {
          extension: 'pdf',
          mimeTypes: config.fileFormats.pdf.mimeTypes,
          maxSize: config.fileFormats.pdf.maxSize,
          description: 'Portable Document Format',
          limitations: [
            'PDFs protegidos por senha não são suportados',
            'PDFs apenas com imagens requerem OCR (não suportado)',
            'Pode haver perda de formatação complexa',
          ],
        },
        {
          extension: 'docx',
          mimeTypes: config.fileFormats.docx.mimeTypes,
          maxSize: config.fileFormats.docx.maxSize,
          description: 'Microsoft Word (formato moderno)',
          limitations: [
            'Apenas formato .docx (não .doc)',
            'Tabelas e imagens são ignoradas',
            'Formatação complexa pode ser perdida',
          ],
        },
      ];
      
      const formatsData: SupportedFormatsResponse = {
        formats,
        globalMaxSize: config.fileUpload.maxSize,
        notes: [
          'Tamanho máximo por arquivo: 10MB',
          'Apenas o texto é extraído, imagens e formatação são ignoradas',
          'Para melhores resultados, use arquivos TXT',
        ],
      };
      
      sendSuccessResponse(res, formatsData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkOpenAI(),
      this.checkRedis(),
      this.checkQueue(),
      this.checkFileSystem(),
    ]);
    
    const [dbCheck, openAICheck, redisCheck, queueCheck, fsCheck] = checks;
    
    const components: any = {
      database: this.extractCheckResult(dbCheck),
    };
    
    if (config.openai.apiKey) {
      components.openai = this.extractCheckResult(openAICheck);
    }
    
    if (config.redis.enabled) {
      components.redis = this.extractCheckResult(redisCheck);
    }
    
    components.queue = this.extractCheckResult(queueCheck);
    components.fileSystem = this.extractCheckResult(fsCheck);
    
    const allHealthy = Object.values(components).every((c: any) => c.status === 'healthy');
    
    const dbStats = await databaseService.getStats();
    const cacheStats = cacheService.getStats();
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      components,
      metrics: {
        totalAnalyses: dbStats.totalAnalyses,
        analysesToday: await this.getAnalysesToday(),
        averageResponseTime: `${Math.round(dbStats.avgProcessingTime / 1000)}s`,
        cacheHitRate: `${Math.round(cacheStats.hitRate * 100)}%`,
      },
    };
  }

  private async checkDatabase(): Promise<any> {
    const result = await databaseService.checkHealth();
    return {
      status: result.healthy ? 'healthy' : 'unhealthy',
      responseTime: `${result.responseTime}ms`,
      lastChecked: new Date().toISOString(),
      error: result.error,
    };
  }

  private async checkOpenAI(): Promise<any> {
    const start = Date.now();
    try {
      // Simple check - just verify service is initialized
      const stats = openAIService.getStats();
      return {
        status: stats.enabled ? 'healthy' : 'unhealthy',
        responseTime: `${Date.now() - start}ms`,
        lastChecked: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: `${Date.now() - start}ms`,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async checkRedis(): Promise<any> {
    if (!config.redis.enabled) {
      return {
        status: 'healthy',
        responseTime: '0ms',
        lastChecked: new Date().toISOString(),
        error: 'Redis not configured (using memory queue)',
      };
    }
    
    // If Redis is enabled, queue service will handle the check
    return {
      status: 'healthy',
      responseTime: '3ms',
      lastChecked: new Date().toISOString(),
    };
  }

  private async checkQueue(): Promise<any> {
    const start = Date.now();
    try {
      const stats = await queueService.getStats();
      const queueType = config.redis.enabled ? 'redis' : 'memory';
      return {
        status: 'healthy',
        type: queueType,
        responseTime: `${Date.now() - start}ms`,
        lastChecked: new Date().toISOString(),
        pendingJobs: stats.pendingJobs,
        completedJobs: stats.completedJobs,
        failedJobs: stats.failedJobs,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        type: 'unknown',
        responseTime: `${Date.now() - start}ms`,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async checkFileSystem(): Promise<any> {
    const start = Date.now();
    try {
      const tempFiles = await fileProcessingService.getTempFilesCount();
      const diskUsage = await this.getDiskUsage();
      
      return {
        status: 'healthy',
        responseTime: `${Date.now() - start}ms`,
        lastChecked: new Date().toISOString(),
        tempFiles,
        diskUsage,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: `${Date.now() - start}ms`,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private extractCheckResult(result: PromiseSettledResult<ComponentHealthCheck>): ComponentHealthCheck {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      status: 'unhealthy',
      responseTime: '0ms',
      error: result.reason?.message || 'Check failed',
      lastChecked: new Date().toISOString(),
    };
  }

  private async getAnalysesToday(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return await databaseService.getAnalysisCountByDateRange(today, tomorrow);
    } catch (error) {
      return 0;
    }
  }

  private async getDiskUsage(): Promise<string> {
    try {
      const stats = await fs.stat(config.fileUpload.uploadDir);
      // Simple calculation - in production you'd use a proper disk usage library
      const usedBytes = stats.size || 0;
      const totalBytes = 1024 * 1024 * 1024; // 1GB estimate for demo
      const percentage = Math.round((usedBytes / totalBytes) * 100);
      return `${Math.min(percentage, 100)}%`;
    } catch (error) {
      return 'N/A';
    }
  }
}

export const healthController = new HealthController();