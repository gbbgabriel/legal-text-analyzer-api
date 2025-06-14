import { Router } from 'express';
import { healthController } from '../controllers/HealthController';
import { statusRateLimit } from '../middleware/RateLimitMiddleware';
import { asyncHandler } from '../middleware/ErrorHandlerMiddleware';

const router = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Verifica saúde da API
 *     description: Retorna status detalhado de todos os componentes da aplicação
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Sistema saudável
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
 *                     status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     components:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                         openai:
 *                           type: object
 *                         redis:
 *                           type: object
 *                         queue:
 *                           type: object
 *                         fileSystem:
 *                           type: object
 *                     metrics:
 *                       type: object
 *       503:
 *         description: Sistema com problemas
 */
router.get(
  '/health',
  statusRateLimit,
  asyncHandler(healthController.getHealth.bind(healthController))
);

/**
 * @swagger
 * /api/v1/stats:
 *   get:
 *     summary: Estatísticas da API
 *     description: Retorna estatísticas de uso e performance da API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Estatísticas da API
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
 *                     database:
 *                       type: object
 *                     queue:
 *                       type: object
 *                     cache:
 *                       type: object
 *                     openai:
 *                       type: object
 *                     system:
 *                       type: object
 */
router.get(
  '/stats',
  statusRateLimit,
  asyncHandler(healthController.getStats.bind(healthController))
);

/**
 * @swagger
 * /api/v1/supported-formats:
 *   get:
 *     summary: Formatos de arquivo suportados
 *     description: Lista todos os formatos de arquivo suportados para upload
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Lista de formatos suportados
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
 *                     formats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           extension:
 *                             type: string
 *                           mimeTypes:
 *                             type: array
 *                             items:
 *                               type: string
 *                           maxSize:
 *                             type: number
 *                           description:
 *                             type: string
 *                           limitations:
 *                             type: array
 *                             items:
 *                               type: string
 *                     globalMaxSize:
 *                       type: number
 *                     notes:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get(
  '/supported-formats',
  statusRateLimit,
  asyncHandler(healthController.getSupportedFormats.bind(healthController))
);

/**
 * @swagger
 * /api/v1/debug:
 *   get:
 *     summary: Debug do worker e queue
 *     description: Informações de debug para diagnosticar problemas
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Informações de debug
 */
router.get(
  '/debug',
  statusRateLimit,
  asyncHandler(healthController.getDebug.bind(healthController))
);

export default router;