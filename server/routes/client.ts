/**
 * @file Client API Routes - OPTIMIZED
 * @description Client-facing endpoints with shared utilities and lean code
 */

import { Router, Response } from 'express';
import { requireRole } from '../middleware/auth';
import { SeoRequestSchema } from '@rylie-seo/seo-schema';
import { AuthenticatedRequest } from '../utils/types';
import { sendSuccess, sendError, generateId, validateRequiredFields, logUserAction } from '../utils/responses';
import { createLogger } from '../utils/logger';
import { mockData } from '../utils/mockData';

const router = Router();
const logger = createLogger('client-api');

router.use(requireRole(['client']));

/**
 * POST /api/client/requests - Submit new SEO request
 */
router.post('/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = SeoRequestSchema.parse(req.body);
    
    const request = {
      id: generateId('req'),
      type: validatedData.type,
      clientId: req.user?.id,
      tenantId: req.user?.tenantId,
      status: 'pending',
      data: validatedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedAgency: null,
    };

    logUserAction('New client request submitted', req.user!, {
      requestId: request.id,
      type: validatedData.type
    });

    sendSuccess(res, {
      requestId: request.id,
      status: request.status,
      type: request.type,
      submittedAt: request.createdAt
    }, `Your ${validatedData.type} request has been submitted successfully`, {
      branding: req.tenantBranding
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return sendError(res, 400, 'Invalid request data', {
        error,
        userId: req.user?.id,
        action: 'Client request validation failed'
      }, { details: error.message, branding: req.tenantBranding });
    }

    sendError(res, 500, 'Failed to submit request', {
      error,
      userId: req.user?.id,
      action: 'Client request submission failed'
    }, { message: 'Please try again or contact support', branding: req.tenantBranding });
  }
});

/**
 * GET /api/client/requests - Get all client requests
 */
router.get('/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logUserAction('Client requests retrieved', req.user!, {
      requestCount: mockData.requests.length
    });

    sendSuccess(res, mockData.requests, undefined, {
      total: mockData.requests.length,
      branding: req.tenantBranding
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve requests', {
      error,
      userId: req.user?.id,
      action: 'Client requests retrieval failed'
    }, { branding: req.tenantBranding });
  }
});

/**
 * POST /api/client/message - Send chat message
 */
router.post('/message', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, requestId, threadId } = req.body;

    if (!message?.trim()) {
      return sendError(res, 400, 'Message content is required', undefined, {
        branding: req.tenantBranding
      });
    }

    const messageObj = {
      id: generateId('msg'),
      content: message.trim(),
      senderId: req.user?.id!,
      senderRole: 'client',
      requestId: requestId || null,
      threadId: threadId || generateId('thread'),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    logUserAction('Client message sent', req.user!, {
      messageId: messageObj.id,
      requestId,
      threadId: messageObj.threadId,
      messageLength: message.length
    });

    sendSuccess(res, {
      messageId: messageObj.id,
      threadId: messageObj.threadId,
      timestamp: messageObj.timestamp,
      status: messageObj.status
    }, 'Your message has been sent', { branding: req.tenantBranding });

  } catch (error) {
    sendError(res, 500, 'Failed to send message', {
      error,
      userId: req.user?.id,
      action: 'Client message send failed'
    }, { branding: req.tenantBranding });
  }
});

/**
 * GET /api/client/messages/:threadId - Get thread messages
 */
router.get('/messages/:threadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const messages = mockData.messages.filter(m => m.threadId === threadId);

    // Add branding to system messages
    const brandedMessages = messages.map(msg => ({
      ...msg,
      ...(msg.senderRole === 'system' && { branding: req.tenantBranding })
    }));

    logUserAction('Client messages retrieved', req.user!, {
      threadId,
      messageCount: messages.length
    });

    sendSuccess(res, brandedMessages, undefined, {
      threadId,
      total: messages.length,
      branding: req.tenantBranding
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve messages', {
      error,
      userId: req.user?.id,
      action: 'Client messages retrieval failed',
      details: { threadId: req.params.threadId }
    }, { branding: req.tenantBranding });
  }
});

/**
 * POST /api/client/onboarding - Handle onboarding
 */
router.post('/onboarding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requiredFields = ['businessName', 'websiteUrl', 'email'];
    const missingFields = validateRequiredFields(req.body, requiredFields);

    if (missingFields.length > 0) {
      return sendError(res, 400, 'Missing required information', undefined, {
        missingFields,
        branding: req.tenantBranding
      });
    }

    logUserAction('Client onboarding data collected', req.user!, {
      businessName: req.body.businessName,
      websiteUrl: req.body.websiteUrl
    });

    sendSuccess(res, {
      nextSteps: [
        'We\'ll analyze your website within 24 hours',
        'You\'ll receive an initial SEO assessment',
        'We\'ll set up your reporting dashboard'
      ]
    }, 'Thank you! Your onboarding information has been saved.', {
      branding: req.tenantBranding
    });

  } catch (error) {
    sendError(res, 500, 'Failed to process onboarding information', {
      error,
      userId: req.user?.id,
      action: 'Client onboarding failed'
    }, { branding: req.tenantBranding });
  }
});

export { router as clientRoutes };