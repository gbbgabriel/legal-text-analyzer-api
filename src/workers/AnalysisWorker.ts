import { EventEmitter } from 'events';
import { Job } from 'bull';
import { queueService } from '../services/QueueService';
import { legalTextAnalysisService } from '../services/LegalTextAnalysisService';
import { databaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { AnalysisJob } from '../types';
import { config } from '../config';

export class AnalysisWorker extends EventEmitter {
  private isRunning: boolean = false;
  private concurrency: number;
  private activeJobs: Set<string> = new Set();

  constructor() {
    super();
    this.concurrency = config.queue.concurrency;
    this.setupEventListeners();
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting analysis worker with concurrency: ${this.concurrency}`);
    logger.info(`Worker started successfully, isRunning: ${this.isRunning}`);

    // Start processing
    void this.processJobs();

    // Setup event listeners for queue
    this.setupQueueListeners();
    
    logger.info('Worker initialization complete');
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Stopping analysis worker');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Event listeners are now handled per job instance
  }

  /**
   * Setup queue event listeners
   */
  private setupQueueListeners(): void {
    // For memory queue (when Redis is not available)
    queueService.on('job:added', () => {
      if (this.activeJobs.size < this.concurrency) {
        void this.processNextJob();
      }
    });

    // For Bull queue (when Redis is available)
    const bullQueue = queueService.getBullQueue();
    if (bullQueue) {
      logger.info(`Setting up Bull queue processing with concurrency: ${this.concurrency}`);
      // Process jobs with Bull
      void bullQueue.process(this.concurrency, this.processBullJob.bind(this));
      logger.info('Bull queue processing setup complete');
    } else {
      logger.info('No Bull queue available, using memory queue only');
    }
  }

  /**
   * Main job processing loop for memory queue
   */
  private async processJobs(): Promise<void> {
    logger.info('Starting job processing loop');
    while (this.isRunning) {
      if (this.activeJobs.size < this.concurrency) {
        await this.processNextJob();
      }
      
      // Small delay to prevent busy waiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    logger.info('Job processing loop stopped');
  }

  /**
   * Process next job from memory queue
   */
  private async processNextJob(): Promise<void> {
    try {
      const job = queueService.getNextJob();
      if (!job) {
        logger.debug('No jobs available in queue');
        return;
      }

      this.activeJobs.add(job.analysisId);
      logger.info(`Processing job: ${job.analysisId}`);

      await this.processJob(job);
      
      this.activeJobs.delete(job.analysisId);
      queueService.completeJob(job.analysisId);
      logger.info(`Job completed and removed: ${job.analysisId}`);
    } catch (error) {
      logger.error('Error processing job from memory queue', error);
    }
  }

  /**
   * Process Bull queue job
   */
  private async processBullJob(job: Job<AnalysisJob>): Promise<void> {
    const analysisJob: AnalysisJob = job.data;
    
    logger.info(`Bull job started: ${analysisJob.analysisId}`);
    
    try {
      // Update progress in Bull
      await job.progress(0);
      
      // Process the job
      await this.processJob(analysisJob, job);
      
      logger.info(`Bull job completed: ${analysisJob.analysisId}`);
    } catch (error) {
      logger.error(`Bull job failed: ${analysisJob.analysisId}`, error);
      throw error; // Bull will handle retries
    }
  }

  /**
   * Process individual job
   */
  private async processJob(analysisJob: AnalysisJob, bullJob?: Job<AnalysisJob>): Promise<void> {
    const { analysisId, text } = analysisJob;
    
    try {
      // Update status to processing
      await databaseService.updateAnalysis(analysisId, {
        status: 'processing',
        progress: 0,
      });

      // Store the current analysisId being processed
      const currentAnalysisId = analysisId;
      
      // Progress handler that filters by analysisId
      const progressHandler = (data: { current: number; total: number; percentage: number }) => {
        // Only handle progress for the current analysis
        if (this.activeJobs.has(currentAnalysisId)) {
          void this.updateJobProgress(currentAnalysisId, data, bullJob);
        }
      };
      
      legalTextAnalysisService.on('progress', progressHandler);

      try {
        // Perform analysis
        const result = await legalTextAnalysisService.analyzeLegalText(text);
        
        // Update with result
        await databaseService.updateAnalysis(analysisId, {
          status: 'completed',
          progress: 100,
          result,
          processingTime: result.processingTime,
          chunksProcessed: result.chunksProcessed,
          completedAt: new Date(),
        });

        logger.info(`Analysis completed: ${analysisId} (${result.processingTime}ms)`);
        
        // Emit completion event
        this.emit('job:completed', { analysisId, result });
        
      } finally {
        // Remove progress listener
        legalTextAnalysisService.removeListener('progress', progressHandler);
      }
      
    } catch (error) {
      logger.error(`Analysis failed for job ${analysisId}`, error);
      
      // Update with error
      await databaseService.updateAnalysis(analysisId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date(),
      });
      
      // For memory queue, handle retry
      if (!bullJob) {
        queueService.failJob(analysisId, error instanceof Error ? error : new Error('Unknown error'));
      }
      
      // Emit failure event
      this.emit('job:failed', { 
        analysisId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      throw error;
    }
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    analysisId: string,
    progressData: { current: number; total: number; percentage: number },
    bullJob?: Job<AnalysisJob>
  ): Promise<void> {
    try {
      const progress = progressData.percentage || 0;
      
      // Update database
      await databaseService.updateAnalysis(analysisId, {
        progress,
      });
      
      // Update Bull job progress
      if (bullJob) {
        await bullJob.progress(progress);
      }
      
      // Emit progress event
      this.emit('job:progress', { analysisId, progress });
      
      logger.debug(`Job progress updated: ${analysisId} - ${progress}%`);
    } catch (error) {
      logger.error(`Failed to update progress for job ${analysisId}`, error);
    }
  }


  /**
   * Get worker statistics
   */
  getStats(): {
    isRunning: boolean;
    concurrency: number;
    activeJobs: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      concurrency: this.concurrency,
      activeJobs: this.activeJobs.size,
      uptime: process.uptime(),
    };
  }
}

// Export singleton instance
export const analysisWorker = new AnalysisWorker();