import { Router } from 'express';
import { logger } from '../utils/errors';

const router = Router();

// Agency dashboard
router.get('/dashboard', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        message: 'Agency dashboard - Client management and reporting',
        features: ['Client Management', 'White-label Reports', 'Task Management', 'Analytics Overview'],
        user: req.user || null
      }
    });
  } catch (error) {
    logger.error('Agency dashboard error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agency client management
router.get('/clients', async (req, res) => {
  res.json({
    status: 'success',
    data: {
      clients: [],
      message: 'Agency clients endpoint'
    }
  });
});

export { router as agencyRoutes };
export default router;