import { Router } from 'express';
import { logger } from '../../utils/errors';

const router = Router();

// GA4 onboarding endpoint
router.post('/onboarding', async (req, res) => {
  try {
    const { propertyId, serviceAccountKey, clientId } = req.body;
    
    if (!propertyId || !serviceAccountKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['propertyId', 'serviceAccountKey']
      });
    }

    logger.info('GA4 onboarding request', { 
      propertyId, 
      clientId,
      hasServiceAccount: !!serviceAccountKey 
    });

    // TODO: Implement actual GA4 integration
    res.json({
      status: 'success',
      data: {
        message: 'GA4 onboarding initiated',
        propertyId,
        clientId,
        note: 'Full integration pending GA4 package fixes'
      }
    });
  } catch (error) {
    logger.error('GA4 onboarding error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GA4 property status
router.get('/properties/:propertyId/status', async (req, res) => {
  res.json({
    status: 'success',
    data: {
      propertyId: req.params.propertyId,
      connected: false,
      lastSync: null,
      message: 'GA4 integration pending'
    }
  });
});

export default router;