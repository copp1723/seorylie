import { Router } from 'express';
import { logger } from '../utils/errors';

const router = Router();

// Client dashboard endpoint
router.get('/dashboard', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        message: 'Client dashboard - SEO reports and analytics',
        features: ['SEO Reports', 'Keyword Rankings', 'Site Audits', 'Backlink Analysis'],
        user: req.user || null
      }
    });
  } catch (error) {
    logger.error('Client dashboard error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Client SEO reports
router.get('/reports', async (req, res) => {
  res.json({
    status: 'success',
    data: {
      reports: [],
      message: 'SEO reports endpoint'
    }
  });
});

// Client requests endpoint - handle SEO team escalations from chat
router.post('/requests', async (req, res) => {
  try {
    const { type, description, context, priority = 'normal', source = 'web-console' } = req.body;
    
    if (!type || !description) {
      return res.status(400).json({
        error: 'Missing required fields: type and description'
      });
    }

    // For now, return success with mock data until database is connected
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('SEO request created', {
      requestId,
      type,
      description: description.substring(0, 100) + '...',
      priority,
      source
    });

    res.status(201).json({
      status: 'success',
      data: {
        id: requestId,
        type,
        description,
        priority,
        status: 'pending',
        created_at: new Date().toISOString(),
        message: 'Request submitted successfully. Our SEO team will review this and get back to you within 24 hours.'
      }
    });
  } catch (error) {
    logger.error('Client requests error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as clientRoutes };
export default router;