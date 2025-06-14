import Bull from 'bull';
import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AnalysisJob } from '../types';

export class QueueService extends EventEmitter {
  private queue: Bull.Queue<AnalysisJob> | null = null;
  private memoryQueue: AnalysisJob[] = [];
  private processing: Set<string> = new Set();
  private useRedis: boolean;
  private cachedStats: {
    pendingJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    lastUpdated: number;
  } = {
    pendingJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    lastUpdated: 0,
  };

  constructor() {
    super();
    this.useRedis = config.redis.enabled;
    

    if (this.useRedis) {
      try {
        logger.info(`Initializing Redis queue with URL: ${config.redis.url}`);
        this.queue = new Bull('legal-analysis', {
          redis: config.redis.url,
          defaultJobOptions: {
            removeOnComplete: 5,
            removeOnFail: 3,
            attempts: config.queue.maxRetries,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        });

        this.setupQueueEvents();
        void this.initializeRedisConnection();
        logger.info('Queue service initialized with Redis');
      } catch (error) {
        logger.warn('Failed to initialize Redis queue, falling back to memory queue', error);
        this.useRedis = false;
        this.queue = null;
      }
    } else {
      logger.info('Queue service initialized with memory queue');
    }
  }

  /**
   * Add job to queue
   */
  async addJob(job: AnalysisJob): Promise<void> {
    if (this.useRedis && this.queue) {
      const priority = this.calculatePriority(job.text.length);
      await this.queue.add(job, { priority });
      logger.info(`Job ${job.analysisId} added to Redis queue with priority ${priority}`);
      // Invalidate cache when new job is added
      this.cachedStats.lastUpdated = 0;
    } else {
      // Memory queue implementation
      const priority = this.calculatePriority(job.text.length);
      job.priority = priority;
      this.memoryQueue.push(job);
      this.memoryQueue.sort((a, b) => b.priority - a.priority);
      logger.info(`Job ${job.analysisId} added to memory queue with priority ${priority}`);

      // Emit event for worker to process
      this.emit('job:added', job);
    }
  }

  /**
   * Get next job from memory queue
   */
  getNextJob(): AnalysisJob | null {
    if (this.useRedis) {
      return null; // Bull handles this automatically
    }

    // Find first job not being processed
    const job = this.memoryQueue.find((j) => !this.processing.has(j.analysisId));
    if (job) {
      this.processing.add(job.analysisId);
    }
    return job || null;
  }

  /**
   * Mark job as completed
   */
  completeJob(analysisId: string): void {
    if (!this.useRedis) {
      this.processing.delete(analysisId);
      this.memoryQueue = this.memoryQueue.filter((j) => j.analysisId !== analysisId);
      logger.info(`Job ${analysisId} completed and removed from memory queue`);
    }
  }

  /**
   * Mark job as failed
   */
  failJob(analysisId: string, error: Error): void {
    if (!this.useRedis) {
      this.processing.delete(analysisId);
      const job = this.memoryQueue.find((j) => j.analysisId === analysisId);

      if (job) {
        job.attempts++;
        if (job.attempts >= config.queue.maxRetries) {
          this.memoryQueue = this.memoryQueue.filter((j) => j.analysisId !== analysisId);
          logger.error(`Job ${analysisId} failed after ${job.attempts} attempts`, error);
          this.emit('job:failed', { job, error });
        } else {
          logger.warn(`Job ${analysisId} failed, retrying (attempt ${job.attempts})`);
          // Re-add to queue for retry
          setTimeout(
            () => {
              this.processing.delete(analysisId);
              this.emit('job:added', job);
            },
            Math.pow(2, job.attempts) * 1000
          );
        }
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
  }> {
    if (this.useRedis && this.queue) {
      try {
        const start = Date.now();
        const [waiting, active, completed, failed] = await Promise.all([
          this.queue.getWaitingCount(),
          this.queue.getActiveCount(),
          this.queue.getCompletedCount(),
          this.queue.getFailedCount(),
        ]);
        const duration = Date.now() - start;

        logger.info(`Queue stats retrieved in ${duration}ms`);

        return {
          pendingJobs: waiting,
          activeJobs: active,
          completedJobs: completed,
          failedJobs: failed,
        };
      } catch (error) {
        logger.warn('Queue stats from Redis failed, using fallback', error);
        // Fallback to memory queue stats
      }
    }

    // Memory queue stats
    return {
      pendingJobs: this.memoryQueue.length - this.processing.size,
      activeJobs: this.processing.size,
      completedJobs: 0, // Not tracked in memory implementation
      failedJobs: 0, // Not tracked in memory implementation
    };
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedisConnection(): Promise<void> {
    if (!this.queue) return;

    try {
      // Test Redis connection by getting queue stats
      await this.queue.getWaitingCount();
      await this.updateStatsCache();
    } catch (error) {
      logger.warn('Redis not available, falling back to memory queue');
      this.useRedis = false;
      this.queue = null;
    }
  }


  /**
   * Update cached statistics
   */
  private async updateStatsCache(): Promise<void> {
    if (!this.queue || !this.useRedis) return;

    try {
      const start = Date.now();
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);
      const duration = Date.now() - start;

      logger.info(`Queue stats updated in ${duration}ms`);

      this.cachedStats = {
        pendingJobs: waiting,
        activeJobs: active,
        completedJobs: completed,
        failedJobs: failed,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      // Silently switch to memory queue if Redis fails
      this.useRedis = false;
      this.queue = null;
    }
  }

  /**
   * Calculate priority based on text size
   * Larger texts get higher priority
   */
  private calculatePriority(textLength: number): number {
    if (textLength > 100000) return 3; // Very high priority
    if (textLength > 50000) return 2; // High priority
    if (textLength > 10000) return 1; // Medium priority
    return 0; // Low priority
  }

  /**
   * Setup Bull queue events
   */
  private setupQueueEvents(): void {
    if (!this.queue) return;

    this.queue.on('completed', (job) => {
      logger.info(`Job ${job.data.analysisId} completed`);
      this.emit('job:completed', job.data);
      // Invalidate cache when job completes
      this.cachedStats.lastUpdated = 0;
    });

    this.queue.on('failed', (job, error) => {
      logger.error(`Job ${job.data.analysisId} failed`, error);
      this.emit('job:failed', { job: job.data, error });
      // Invalidate cache when job fails
      this.cachedStats.lastUpdated = 0;
    });

    this.queue.on('progress', (job, progress) => {
      this.emit('job:progress', { analysisId: job.data.analysisId, progress });
    });
  }

  /**
   * Get Bull queue instance (for workers)
   */
  getBullQueue(): Bull.Queue<AnalysisJob> | null {
    return this.queue;
  }

  /**
   * Close queue connections
   */
  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const queueService = new QueueService();
