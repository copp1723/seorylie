import { Router } from 'express';
import { logger } from '../utils/errors';

const router = Router();

// Admin dashboard
router.get('/dashboard', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        message: 'Admin dashboard - System management',
        features: ['User Management', 'System Configuration', 'Monitoring', 'Audit Logs'],
        user: req.user || null
      }
    });
  } catch (error) {
    logger.error('Admin dashboard error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System configuration
router.get('/config', async (req, res) => {
  res.json({
    status: 'success',
    data: {
      config: {
        version: '1.0.0',
        environment: process.env.NODE_ENV
      }
    }
  });
});

export { router as adminRoutes };
export default router;