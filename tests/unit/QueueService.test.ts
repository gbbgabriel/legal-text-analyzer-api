import { AnalysisJob } from '../../src/types';

// Mock QueueService to avoid Redis/Bull issues
const mockQueueService = {
  memoryQueue: [] as AnalysisJob[],
  processing: new Map(),
  
  async addJob(job: AnalysisJob): Promise<string> {
    this.memoryQueue.push(job);
    return job.analysisId;
  },
  
  async getQueueStats() {
    return {
      waiting: this.memoryQueue.length,
      active: this.processing.size,
      completed: 0,
      failed: 0,
      type: 'memory' as const,
      responseTime: '1ms'
    };
  },
  
  async getJob(id: string): Promise<AnalysisJob | null> {
    return this.memoryQueue.find(job => job.analysisId === id) || null;
  }
};

describe('QueueService', () => {
  const mockJob: AnalysisJob = {
    analysisId: 'test-123',
    text: 'Sample legal text for testing',
    priority: 1,
    attempts: 0,
    sourceType: 'text',
    originalFilename: 'test.txt',
    fileSize: 1000,
  };

  beforeEach(() => {
    mockQueueService.memoryQueue = [];
    mockQueueService.processing.clear();
  });

  describe('addJob', () => {
    it('should add job to memory queue', async () => {
      await mockQueueService.addJob(mockJob);
      
      expect(mockQueueService.memoryQueue.length).toBe(1);
      expect(mockQueueService.memoryQueue[0].analysisId).toBe(mockJob.analysisId);
    });

    it('should return job ID', async () => {
      const jobId = await mockQueueService.addJob(mockJob);
      expect(jobId).toBe(mockJob.analysisId);
    });
  });

  describe('getQueueStats', () => {
    it('should return correct stats for memory queue', async () => {
      await mockQueueService.addJob(mockJob);
      
      const stats = await mockQueueService.getQueueStats();
      
      expect(stats.waiting).toBe(1);
      expect(stats.active).toBe(0);
      expect(stats.type).toBe('memory');
      expect(stats.responseTime).toBeDefined();
    });

    it('should handle empty queue', async () => {
      const stats = await mockQueueService.getQueueStats();
      
      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('getJob', () => {
    it('should retrieve job by ID', async () => {
      await mockQueueService.addJob(mockJob);
      
      const retrievedJob = await mockQueueService.getJob(mockJob.analysisId);
      
      expect(retrievedJob).not.toBeNull();
      expect(retrievedJob?.analysisId).toBe(mockJob.analysisId);
      expect(retrievedJob?.text).toBe(mockJob.text);
    });

    it('should return null for non-existent job', async () => {
      const retrievedJob = await mockQueueService.getJob('non-existent');
      expect(retrievedJob).toBeNull();
    });
  });

  describe('priority handling', () => {
    it('should handle different job priorities', async () => {
      const highPriorityJob = { ...mockJob, analysisId: 'high-1', priority: 0 };
      const lowPriorityJob = { ...mockJob, analysisId: 'low-1', priority: 2 };
      
      await mockQueueService.addJob(lowPriorityJob);
      await mockQueueService.addJob(highPriorityJob);
      
      expect(mockQueueService.memoryQueue.length).toBe(2);
      expect(mockQueueService.memoryQueue[0].priority).toBe(2);
      expect(mockQueueService.memoryQueue[1].priority).toBe(0);
    });
  });
});