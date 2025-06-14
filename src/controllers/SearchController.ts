import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { ApiResponse, SearchResult } from '../types';

export class SearchController {
  /**
   * GET /search-term?term=...
   * Search for term in recent analyses
   */
  async searchTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { term } = req.query;
      
      if (!term || typeof term !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Parâmetro "term" é obrigatório',
          code: 'INVALID_REQUEST',
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
        });
        return;
      }
      
      logger.info(`Searching for term: ${term}`);
      
      // Search in database
      const searchResult = await databaseService.searchTerm(term);
      
      // Save search history
      await databaseService.saveSearchHistory({
        term,
        found: searchResult.found,
        analysisId: searchResult.analyses[0]?.id,
      });
      
      // Prepare response data
      const responseData: SearchResult = {
        term,
        found: searchResult.found,
        analyses: searchResult.analyses.map(analysis => ({
          id: analysis.id,
          text: analysis.text,
          createdAt: analysis.createdAt,
        })),
        totalOccurrences: searchResult.totalOccurrences,
      };
      
      const response: ApiResponse<SearchResult> = {
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /search-history
   * Get recent search history
   */
  async getSearchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      const history = await databaseService.getSearchHistory(limit);
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          searches: history.map(item => ({
            term: item.term,
            found: item.found,
            searchedAt: item.searchedAt,
            analysisId: item.analysisId,
          })),
          total: history.length,
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();