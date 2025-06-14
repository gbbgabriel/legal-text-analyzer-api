import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from '../services/DatabaseService';
import { legalTextAnalysisService } from '../services/LegalTextAnalysisService';
import { fileProcessingService } from '../services/FileProcessingService';
import { queueService } from '../services/QueueService';
import { logger } from '../utils/logger';
import { 
  ErrorCode, 
  AnalysisStatus,
  ApiResponse 
} from '../types';
import { 
  sendSuccessResponse
} from '../utils/response';

export class AnalysisController {
  /**
   * POST /analyze-text
   * Analyze text directly
   */
  async analyzeText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text } = req.body;
      const analysisId = uuidv4();
      
      // Check if text is small enough for synchronous processing
      const isSmallText = text.length < 50000;
      
      if (isSmallText) {
        // Process synchronously
        logger.info(`Processing text synchronously (${text.length} chars)`);
        
        // Create analysis record
        await databaseService.createAnalysis({
          id: analysisId,
          text: text.substring(0, 5000), // Store first 5000 chars
          textLength: text.length,
          type: legalTextAnalysisService.isLegalText(text) ? 'legal' : 'general',
          sourceType: 'text',
        });
        
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
          
          sendSuccessResponse(res, result, 200, analysisId);
        } catch (error: any) {
          // Update with error
          await databaseService.updateAnalysis(analysisId, {
            status: 'failed',
            error: error.message,
            failedAt: new Date(),
          });
          throw error;
        }
      } else {
        // Process asynchronously
        logger.info(`Queueing text for async processing (${text.length} chars)`);
        
        // Create analysis record
        await databaseService.createAnalysis({
          id: analysisId,
          text: text.substring(0, 5000), // Store first 5000 chars
          textLength: text.length,
          type: legalTextAnalysisService.isLegalText(text) ? 'legal' : 'general',
          sourceType: 'text',
          status: 'processing',
        });
        
        // Add to queue
        await queueService.addJob({
          analysisId,
          text,
          priority: 1,
          attempts: 0,
        });
        
        const estimatedTime = Math.ceil(text.length / 1000); // Rough estimate
        
        const response: ApiResponse<AnalysisStatus> = {
          success: true,
          data: {
            analysisId,
            status: 'processing',
            progress: 0,
            estimatedTime,
          },
          timestamp: new Date().toISOString(),
          requestId: analysisId,
        };
        
        res.status(202).json(response);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /analyze-file
   * Analyze uploaded file
   */
  async analyzeFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado',
          code: ErrorCode.INVALID_REQUEST,
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
        });
        return;
      }
      
      const { path: filePath, originalname, mimetype, size } = req.file;
      const analysisId = uuidv4();
      
      logger.info(`Processing uploaded file: ${originalname} (${size} bytes)`);
      
      try {
        // Process file and extract text
        const fileResult = await fileProcessingService.processFile(
          filePath,
          originalname,
          mimetype
        );
        
        const { extractedText } = fileResult;
        
        // Check if text is small enough for synchronous processing
        const isSmallText = extractedText.length < 50000;
        
        // Create analysis record
        await databaseService.createAnalysis({
          id: analysisId,
          text: extractedText.substring(0, 5000), // Store first 5000 chars
          textLength: extractedText.length,
          type: legalTextAnalysisService.isLegalText(extractedText) ? 'legal' : 'general',
          sourceType: fileResult.sourceType,
          originalFilename: fileResult.originalFilename,
          fileSize: fileResult.fileSize,
          status: isSmallText ? 'processing' : 'processing',
        });
        
        if (isSmallText) {
          // Process synchronously
          logger.info(`Processing file text synchronously (${extractedText.length} chars)`);
          
          try {
            const result = await legalTextAnalysisService.analyzeLegalText(extractedText);
            
            // Update with result
            await databaseService.updateAnalysis(analysisId, {
              status: 'completed',
              progress: 100,
              result,
              processingTime: result.processingTime + fileResult.processingTime,
              chunksProcessed: result.chunksProcessed,
              completedAt: new Date(),
            });
            
            const response: ApiResponse<any> = {
              success: true,
              data: {
                analysisId,
                sourceType: fileResult.sourceType,
                originalFilename: fileResult.originalFilename,
                fileSize: fileResult.fileSize,
                extractedTextLength: fileResult.extractedText.length,
                ...result,
              },
              timestamp: new Date().toISOString(),
              requestId: analysisId,
            };
            
            res.json(response);
          } catch (error: any) {
            await databaseService.updateAnalysis(analysisId, {
              status: 'failed',
              error: error.message,
              failedAt: new Date(),
            });
            throw error;
          }
        } else {
          // Process asynchronously
          logger.info(`Queueing file text for async processing (${extractedText.length} chars)`);
          
          // Add to queue
          await queueService.addJob({
            analysisId,
            text: extractedText,
            priority: 2,
            attempts: 0,
            sourceType: fileResult.sourceType,
            originalFilename: fileResult.originalFilename,
            fileSize: fileResult.fileSize,
          });
          
          const estimatedTime = Math.ceil(extractedText.length / 1000);
          
          const response: ApiResponse<any> = {
            success: true,
            data: {
              analysisId,
              status: 'processing',
              sourceType: fileResult.sourceType,
              originalFilename: fileResult.originalFilename,
              fileSize: fileResult.fileSize,
              extractedTextLength: extractedText.length,
              estimatedTime,
              progress: 0,
              checkStatusUrl: `/api/v1/analysis/${analysisId}/status`,
            },
            timestamp: new Date().toISOString(),
            requestId: analysisId,
          };
          
          res.status(202).json(response);
        }
      } catch (error: any) {
        // File processing error
        logger.error('File processing error', error);
        
        const errorCode = error.message as ErrorCode || ErrorCode.TEXT_EXTRACTION_FAILED;
        const errorMessages: Record<string, string> = {
          [ErrorCode.FILE_TOO_LARGE]: 'Arquivo muito grande (máximo 10MB)',
          [ErrorCode.INVALID_FILE_TYPE]: 'Tipo de arquivo não suportado',
          [ErrorCode.TEXT_EXTRACTION_FAILED]: 'Falha na extração de texto',
          [ErrorCode.CORRUPTED_FILE]: 'Arquivo corrompido ou inválido',
          [ErrorCode.PASSWORD_PROTECTED_PDF]: 'PDF protegido por senha não é suportado',
          [ErrorCode.EMPTY_FILE]: 'Arquivo não contém texto válido',
          [ErrorCode.ENCODING_ERROR]: 'Erro de codificação de caracteres',
          [ErrorCode.UNSUPPORTED_PDF_VERSION]: 'Versão do PDF não suportada',
          [ErrorCode.DOCX_STRUCTURE_ERROR]: 'Estrutura do documento Word inválida',
        };
        
        res.status(400).json({
          success: false,
          error: errorMessages[errorCode] || 'Erro ao processar arquivo',
          code: errorCode,
          details: {
            filename: originalname,
            fileSize: size,
            possibleCauses: this.getPossibleCauses(errorCode),
          },
          suggestions: this.getSuggestions(errorCode),
          supportUrl: '/api/v1/supported-formats',
          timestamp: new Date().toISOString(),
          requestId: analysisId,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /analysis/:id/status
   * Get analysis status
   */
  async getAnalysisStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const analysis = await databaseService.getAnalysis(id);
      
      if (!analysis) {
        res.status(404).json({
          success: false,
          error: 'Análise não encontrada',
          code: ErrorCode.ANALYSIS_NOT_FOUND,
          timestamp: new Date().toISOString(),
          requestId: uuidv4(),
        });
        return;
      }
      
      let parsedResult = undefined;
      if (analysis.status === 'completed' && analysis.result) {
        try {
          // Check if result is already an object (from getAnalysis parsing)
          if (typeof analysis.result === 'object') {
            parsedResult = analysis.result;
          } else if (typeof analysis.result === 'string' && analysis.result !== '[object Object]') {
            parsedResult = JSON.parse(analysis.result);
          }
        } catch (error) {
          logger.error('Failed to parse analysis result:', { analysisId: analysis.id, result: analysis.result, error });
          parsedResult = { error: 'Failed to parse result' };
        }
      }

      const response: ApiResponse<AnalysisStatus> = {
        success: true,
        data: {
          analysisId: analysis.id,
          status: analysis.status as 'processing' | 'completed' | 'failed',
          progress: analysis.progress,
          sourceType: analysis.sourceType,
          originalFilename: analysis.originalFilename || undefined,
          result: parsedResult,
          error: analysis.error || undefined,
          processingTime: analysis.processingTime || undefined,
          completedAt: analysis.completedAt || undefined,
          estimatedTime: analysis.status === 'processing' 
            ? Math.ceil((analysis.textLength / 1000) * (1 - analysis.progress / 100))
            : undefined,
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get possible causes for file errors
   */
  private getPossibleCauses(errorCode: string): string[] {
    const causes: Record<string, string[]> = {
      [ErrorCode.TEXT_EXTRACTION_FAILED]: [
        'Arquivo pode estar corrompido',
        'Formato do arquivo não é suportado',
        'Arquivo contém apenas imagens',
      ],
      [ErrorCode.PASSWORD_PROTECTED_PDF]: [
        'PDF está protegido por senha',
        'PDF tem restrições de leitura',
      ],
      [ErrorCode.CORRUPTED_FILE]: [
        'Arquivo foi corrompido durante upload',
        'Arquivo original já estava danificado',
        'Extensão não corresponde ao conteúdo real',
      ],
      [ErrorCode.EMPTY_FILE]: [
        'Arquivo contém apenas imagens',
        'Arquivo está vazio',
        'Texto não pôde ser extraído',
      ],
    };
    
    return causes[errorCode] || ['Erro desconhecido'];
  }

  /**
   * Get suggestions for file errors
   */
  private getSuggestions(errorCode: string): string[] {
    const suggestions: Record<string, string[]> = {
      [ErrorCode.TEXT_EXTRACTION_FAILED]: [
        'Verifique se o arquivo não está corrompido',
        'Tente converter para TXT primeiro',
        'Consulte /api/v1/supported-formats para limitações',
      ],
      [ErrorCode.PASSWORD_PROTECTED_PDF]: [
        'Remova a proteção por senha do PDF',
        'Exporte o PDF sem proteção',
      ],
      [ErrorCode.CORRUPTED_FILE]: [
        'Tente fazer upload novamente',
        'Verifique a integridade do arquivo original',
        'Use um formato diferente (TXT, PDF ou DOCX)',
      ],
      [ErrorCode.EMPTY_FILE]: [
        'Verifique se o arquivo contém texto',
        'Para PDFs com imagens, use OCR primeiro',
        'Converta para formato TXT',
      ],
    };
    
    return suggestions[errorCode] || ['Tente novamente com outro arquivo'];
  }
}

export const analysisController = new AnalysisController();