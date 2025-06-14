import { Router } from 'express';
import { searchController } from '../controllers/SearchController';
import { validateSearchTerm } from '../middleware/ValidationMiddleware';
import { generalRateLimit } from '../middleware/RateLimitMiddleware';
import { asyncHandler } from '../middleware/ErrorHandlerMiddleware';

const router = Router();

/**
 * @swagger
 * /api/v1/search-term:
 *   get:
 *     summary: Busca termo em análises recentes
 *     description: Busca um termo específico nas análises de texto já realizadas
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           pattern: '^[a-zA-ZÀ-ÿ0-9\s\-_]+$'
 *         description: Termo a ser buscado
 *         example: "contrato"
 *     responses:
 *       200:
 *         description: Resultado da busca
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     term:
 *                       type: string
 *                     found:
 *                       type: boolean
 *                     analyses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           text:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     totalOccurrences:
 *                       type: integer
 *       400:
 *         description: Parâmetros inválidos
 *       429:
 *         description: Muitas requisições
 */
router.get(
  '/search-term',
  generalRateLimit,
  validateSearchTerm,
  asyncHandler(searchController.searchTerm.bind(searchController))
);

/**
 * @swagger
 * /api/v1/search-history:
 *   get:
 *     summary: Obtém histórico de buscas
 *     description: Retorna as buscas realizadas recentemente
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Número máximo de registros a retornar
 *     responses:
 *       200:
 *         description: Histórico de buscas
 *       429:
 *         description: Muitas requisições
 */
router.get(
  '/search-history',
  generalRateLimit,
  asyncHandler(searchController.getSearchHistory.bind(searchController))
);

export default router;