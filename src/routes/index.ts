import { Router } from 'express';
import analysisRoutes from './analysis';
import searchRoutes from './search';
import healthRoutes from './health';

const router = Router();

// Mount routes
router.use(analysisRoutes);
router.use(searchRoutes);
router.use(healthRoutes);

export default router;