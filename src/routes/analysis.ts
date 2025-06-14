import { Router } from 'express';
import { analysisController } from '../controllers/AnalysisController';
import { 
  validateTextAnalysis, 
  validateAnalysisId 
} from '../middleware/ValidationMiddleware';
import { 
  uploadSingle, 
  handleUploadError, 
  validateUploadedFile 
} from '../middleware/FileUploadMiddleware';
import { 
  analysisRateLimit, 
  fileUploadRateLimit 
} from '../middleware/RateLimitMiddleware';
import { asyncHandler } from '../middleware/ErrorHandlerMiddleware';

const router = Router();

/**
 * @swagger
 * /api/v1/analyze-text:
 *   post:
 *     summary: Analisa texto jurídico
 *     description: Analisa um texto jurídico e retorna estatísticas, termos mais frequentes e análise de sentimento
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Texto a ser analisado
 *                 maxLength: 2000000
 *                 example: "Considerando o disposto no artigo 5º da Constituição Federal..."
 *     responses:
 *       200:
 *         description: Análise concluída com sucesso (texto pequeno - síncrono)
 *       202:
 *         description: Análise iniciada (texto grande - assíncrono)
 *       400:
 *         description: Dados inválidos
 *       429:
 *         description: Muitas requisições
 */
router.post(
  '/analyze-text',
  analysisRateLimit,
  validateTextAnalysis,
  asyncHandler(analysisController.analyzeText.bind(analysisController))
);

/**
 * @swagger
 * /api/v1/analyze-file:
 *   post:
 *     summary: Analisa arquivo de texto jurídico
 *     description: Faz upload e analisa um arquivo (TXT, PDF, DOCX)
 *     tags: [Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo a ser analisado (TXT, PDF, DOCX)
 *     responses:
 *       200:
 *         description: Análise concluída com sucesso (arquivo pequeno - síncrono)
 *       202:
 *         description: Análise iniciada (arquivo grande - assíncrono)
 *       400:
 *         description: Arquivo inválido ou erro de processamento
 *       413:
 *         description: Arquivo muito grande
 *       429:
 *         description: Muitas requisições
 */
router.post(
  '/analyze-file',
  fileUploadRateLimit,
  uploadSingle,
  handleUploadError,
  validateUploadedFile,
  asyncHandler(analysisController.analyzeFile.bind(analysisController))
);

/**
 * @swagger
 * /api/v1/analysis/{id}/status:
 *   get:
 *     summary: Verifica status de uma análise
 *     description: Retorna o status atual de uma análise em processamento
 *     tags: [Analysis]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da análise
 *     responses:
 *       200:
 *         description: Status da análise
 *       404:
 *         description: Análise não encontrada
 */
router.get(
  '/analysis/:id/status',
  validateAnalysisId,
  asyncHandler(analysisController.getAnalysisStatus.bind(analysisController))
);

export default router;