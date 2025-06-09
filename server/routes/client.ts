/**
 * @file Client API Routes
 * @description Client-facing endpoints for request submission and chat interactions
 * All responses are white-labeled and branded
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import winston from 'winston';
import { SeoRequestSchema } from '@rylie-seo/seo-schema';

const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'client-api' },
  transports: [
    new winston.transports.Console()
  ],
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    tenantId?: string;
  };
  tenantBranding?: {
    companyName: string;
    logo?: string;
    primaryColor?: string;
  };
  processedByAI?: boolean;
}

// Middleware to ensure only clients can access these routes
router.use(requireRole(['client']));

/**
 * POST /api/client/requests
 * Submit a new SEO request (page, blog, GBP, maintenance, etc.)
 */
router.post('/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    
    // Validate request data using Zod schema
    const validatedData = SeoRequestSchema.parse(req.body);
    
    // Create request object (In production, this would save to database)
    const request = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: validatedData.type,
      clientId: user?.id,
      tenantId: user?.tenantId,
      status: 'pending',
      data: validatedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedAgency: null, // Will be assigned by the system
    };

    logger.info('New client request submitted', {
      requestId: request.id,
      type: validatedData.type,
      clientId: user?.id,
      tenantId: user?.tenantId
    });

    // TODO: Add to queue for agency assignment
    // TODO: Save to database
    
    res.status(201).json({
      success: true,
      message: `Your ${validatedData.type} request has been submitted successfully`,
      data: {
        requestId: request.id,
        status: request.status,
        type: request.type,
        submittedAt: request.createdAt
      },
      branding: req.tenantBranding
    });

  } catch (error) {
    logger.error('Error submitting client request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.user?.id,
      body: req.body
    });

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.message,
        branding: req.tenantBranding
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to submit request',
      message: 'Please try again or contact support',
      branding: req.tenantBranding
    });
  }
});

/**
 * GET /api/client/requests
 * Get all requests for the current client
 */
router.get('/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    
    // TODO: Fetch from database
    // Mock data for now
    const requests = [
      {
        id: 'req_1',
        type: 'blog',
        status: 'in_progress',
        title: 'SEO Blog Post Request',
        submittedAt: '2025-06-08T10:00:00Z',
        updatedAt: '2025-06-08T12:00:00Z',
        estimatedCompletion: '2025-06-10T17:00:00Z'
      },
      {
        id: 'req_2',
        type: 'page',
        status: 'completed',
        title: 'New Service Page',
        submittedAt: '2025-06-07T14:30:00Z',
        updatedAt: '2025-06-08T09:15:00Z',
        completedAt: '2025-06-08T09:15:00Z'
      }
    ];

    logger.info('Client requests retrieved', {
      clientId: user?.id,
      requestCount: requests.length
    });

    res.json({
      success: true,
      data: requests,
      total: requests.length,
      branding: req.tenantBranding
    });

  } catch (error) {
    logger.error('Error retrieving client requests', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve requests',
      branding: req.tenantBranding
    });
  }
});

/**
 * POST /api/client/message
 * Send a chat message (new thread or reply to existing request)
 */
router.post('/message', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const { message, requestId, threadId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required',
        branding: req.tenantBranding
      });
    }

    // Create message object
    const messageObj = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: message.trim(),
      senderId: user?.id,
      senderRole: 'client',
      requestId: requestId || null,
      threadId: threadId || `thread_${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    logger.info('Client message sent', {
      messageId: messageObj.id,
      clientId: user?.id,
      requestId,
      threadId: messageObj.threadId,
      messageLength: message.length
    });

    // TODO: Save to database
    // TODO: Queue for AI processing and agency notification
    
    res.status(201).json({
      success: true,
      message: 'Your message has been sent',
      data: {
        messageId: messageObj.id,
        threadId: messageObj.threadId,
        timestamp: messageObj.timestamp,
        status: messageObj.status
      },
      branding: req.tenantBranding
    });

  } catch (error) {
    logger.error('Error sending client message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      branding: req.tenantBranding
    });
  }
});

/**
 * GET /api/client/messages/:threadId
 * Get chat messages for a specific thread
 */
router.get('/messages/:threadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const { threadId } = req.params;

    // TODO: Fetch from database with proper filtering
    // Mock data for now
    const messages = [
      {
        id: 'msg_1',
        content: 'Hi! I need help with creating a new blog post about automotive SEO.',
        senderId: user?.id,
        senderRole: 'client',
        timestamp: '2025-06-08T10:00:00Z',
        status: 'delivered'
      },
      {
        id: 'msg_2',
        content: 'Thanks for your request! We\'ll help you create an engaging blog post about automotive SEO. What specific topics would you like to cover?',
        senderId: 'rylie_system',
        senderRole: 'system',
        timestamp: '2025-06-08T10:05:00Z',
        status: 'delivered',
        branding: req.tenantBranding
      }
    ];

    logger.info('Client messages retrieved', {
      clientId: user?.id,
      threadId,
      messageCount: messages.length
    });

    res.json({
      success: true,
      data: messages,
      threadId,
      total: messages.length,
      branding: req.tenantBranding
    });

  } catch (error) {
    logger.error('Error retrieving client messages', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.user?.id,
      threadId: req.params.threadId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages',
      branding: req.tenantBranding
    });
  }
});

/**
 * POST /api/client/onboarding
 * Handle client onboarding data collection
 */
router.post('/onboarding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user } = req;
    const onboardingData = req.body;

    // Basic validation
    const requiredFields = ['businessName', 'websiteUrl', 'email'];
    const missingFields = requiredFields.filter(field => !onboardingData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required information',
        missingFields,
        branding: req.tenantBranding
      });
    }

    logger.info('Client onboarding data collected', {
      clientId: user?.id,
      businessName: onboardingData.businessName,
      websiteUrl: onboardingData.websiteUrl
    });

    // TODO: Save onboarding data to database
    // TODO: Trigger initial setup processes

    res.json({
      success: true,
      message: 'Thank you! Your onboarding information has been saved.',
      nextSteps: [
        'We\'ll analyze your website within 24 hours',
        'You\'ll receive an initial SEO assessment',
        'We\'ll set up your reporting dashboard'
      ],
      branding: req.tenantBranding
    });

  } catch (error) {
    logger.error('Error processing client onboarding', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process onboarding information',
      branding: req.tenantBranding
    });
  }
});

export { router as clientRoutes };