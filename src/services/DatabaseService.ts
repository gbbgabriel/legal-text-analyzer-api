import { PrismaClient, Analysis, SearchHistory } from '@prisma/client';
import { logger } from '../utils/logger';

type ParsedAnalysis = Analysis & { result?: any };

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
    
    void this.connectWithRetry();
  }

  /**
   * Parse JSON result safely
   */
  private parseAnalysisResult<T extends { result?: string | null }>(
    analysis: T | null
  ): T | (T & { result: any }) | null {
    if (!analysis || !analysis.result) {
      return analysis;
    }

    try {
      const parsedResult = JSON.parse(analysis.result);
      return { ...analysis, result: parsedResult };
    } catch {
      // Keep as string if parsing fails
      return analysis;
    }
  }

  /**
   * Connect to database with retry logic
   */
  private async connectWithRetry(retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.prisma.$connect();
        logger.info('Database connected successfully');
        return;
      } catch (error) {
        logger.error(`Database connection attempt ${i + 1} failed`, error);
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  /**
   * Create new analysis record
   */
  async createAnalysis(data: {
    id: string;
    text: string;
    textLength: number;
    type?: string;
    sourceType?: string;
    originalFilename?: string;
    fileSize?: number;
    status?: string;
  }): Promise<Analysis> {
    return this.prisma.analysis.create({
      data: {
        ...data,
        type: data.type || 'legal',
        sourceType: data.sourceType || 'text',
        status: data.status || 'processing',
      },
    });
  }

  /**
   * Update analysis record
   */
  async updateAnalysis(
    id: string,
    data: {
      status?: string;
      progress?: number;
      result?: any;
      error?: string;
      processingTime?: number;
      chunksProcessed?: number;
      completedAt?: Date;
      failedAt?: Date;
    }
  ): Promise<Analysis> {
    // Stringify result if it's an object
    const updateData = { ...data };
    if (updateData.result && typeof updateData.result === 'object') {
      try {
        updateData.result = JSON.stringify(updateData.result);
      } catch (error) {
        logger.error('Failed to stringify result:', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          resultType: typeof updateData.result,
          resultLength: JSON.stringify(updateData.result).length 
        });
        // Fallback to ensure we don't save [object Object]
        updateData.result = JSON.stringify({ error: 'Failed to serialize result' });
      }
    }
    
    return this.prisma.analysis.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Get analysis by ID
   */
  async getAnalysis(id: string): Promise<Analysis | null> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id },
    });
    
    return this.parseAnalysisResult(analysis);
  }

  /**
   * Get recent analyses
   */
  async getRecentAnalyses(limit = 10): Promise<Analysis[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    // Parse result JSON for each analysis
    return analyses.map(analysis => {
      if (analysis.result) {
        try {
          (analysis as any).result = JSON.parse(analysis.result);
        } catch {
          // Keep as string if parsing fails
        }
      }
      return analysis;
    });
  }

  /**
   * Search for term in analyses
   */
  async searchTerm(term: string): Promise<{
    found: boolean;
    analyses: ParsedAnalysis[];
    totalOccurrences: number;
  }> {
    const searchTerm = term.toLowerCase();
    
    // Search in completed analyses
    const analyses = await this.prisma.analysis.findMany({
      where: {
        status: 'completed',
        text: {
          contains: searchTerm,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    // Count occurrences
    let totalOccurrences = 0;
    analyses.forEach(analysis => {
      const matches = analysis.text.toLowerCase().match(new RegExp(searchTerm, 'g'));
      totalOccurrences += matches ? matches.length : 0;
    });
    
    // Parse results
    const parsedAnalyses = analyses.map(analysis => this.parseAnalysisResult(analysis)).filter(Boolean) as ParsedAnalysis[];
    
    return {
      found: analyses.length > 0,
      analyses: parsedAnalyses,
      totalOccurrences,
    };
  }

  /**
   * Save search history
   */
  async saveSearchHistory(data: {
    term: string;
    found: boolean;
    analysisId?: string;
  }): Promise<SearchHistory> {
    return this.prisma.searchHistory.create({
      data,
    });
  }

  /**
   * Get search history
   */
  async getSearchHistory(limit = 100): Promise<SearchHistory[]> {
    return this.prisma.searchHistory.findMany({
      orderBy: { searchedAt: 'desc' },
      take: limit,
      include: {
        analysis: true,
      },
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalAnalyses: number;
    completedAnalyses: number;
    failedAnalyses: number;
    totalSearches: number;
    avgProcessingTime: number;
  }> {
    const [
      totalAnalyses,
      completedAnalyses,
      failedAnalyses,
      totalSearches,
      processingTimes,
    ] = await Promise.all([
      this.prisma.analysis.count(),
      this.prisma.analysis.count({ where: { status: 'completed' } }),
      this.prisma.analysis.count({ where: { status: 'failed' } }),
      this.prisma.searchHistory.count(),
      this.prisma.analysis.aggregate({
        where: { processingTime: { not: null } },
        _avg: { processingTime: true },
      }),
    ]);
    
    return {
      totalAnalyses,
      completedAnalyses,
      failedAnalyses,
      totalSearches,
      avgProcessingTime: processingTimes._avg.processingTime || 0,
    };
  }

  /**
   * Clean up old records
   */
  async cleanupOldRecords(daysToKeep = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await this.prisma.analysis.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ['completed', 'failed'] },
      },
    });
    
    logger.info(`Cleaned up ${result.count} old analysis records`);
  }

  /**
   * Check database health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        healthy: true,
        responseTime: Date.now() - start,
      };
    } catch (error: any) {
      return {
        healthy: false,
        responseTime: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Get analysis count by date range
   */
  async getAnalysisCountByDateRange(startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.prisma.analysis.count({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting analysis count by date range', error);
      return 0;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();