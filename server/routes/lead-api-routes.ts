import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LeadService } from '../services/lead-service';
import { ConversationService } from '../services/conversation-service';
import { HandoverService } from '../services/handover-service';
import { 
  inboundLeadRequestSchema,
  replyMessageRequestSchema,
  handoverRequestSchema,
  handoverUpdateRequestSchema,
  leadsQuerySchema,
  conversationsQuerySchema,
  leadCreationResponseSchema,
  messageResponseSchema,
  handoverResponseSchema,
  leadListResponseSchema,
  leadDetailResponseSchema,
  errorResponseSchema
} from '../../shared/api-schemas';
import { 
  validateBody, 
  validateQuery, 
  validateUuidParam,
  validateContentType,
  validateBodySize
} from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const leadService = new LeadService();
const conversationService = new ConversationService();
const handoverService = new HandoverService();

// Common validation middleware for API endpoints
const apiValidation = [
  validateContentType(['application/json']),
  validateBodySize(1024 * 1024) // 1MB limit
];

// Middleware to extract dealership from API key
const extractDealership = (req: Request, res: Response, next: Function) => {
  const dealership = req.dealership;
  if (!dealership) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
  }
  req.dealershipId = dealership.id;
  next();
};

/**
 * @swagger
 * /api/v1/inbound:
 *   post:
 *     summary: Create a new inbound lead
 *     description: Accept parsed lead data from various sources with strict schema validation
 *     tags: [Leads]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InboundLead'
 *     responses:
 *       201:
 *         description: Lead created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeadCreationResponse'
 *       400:
 *         description: Invalid request payload
 *       409:
 *         description: Duplicate lead detected
 *       500:
 *         description: Internal server error
 */
router.post('/inbound', 
  authenticateApiKey,
  extractDealership,
  ...apiValidation,
  validateBody(inboundLeadRequestSchema),
  async (req: Request, res: Response) => {
    try {
      logger.info('Inbound lead API request', {
        dealershipId: req.dealershipId,
        source: req.body.lead.source,
        customerName: req.body.customer.fullName
      });

      const result = await leadService.processInboundLead(
        req.dealershipId,
        req.body
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            leadId: result.leadId,
            customerId: result.customerId,
            conversationId: result.conversationId,
            isExistingCustomer: result.isExistingCustomer,
            warnings: result.warnings
          },
          message: 'Lead created successfully'
        });
      } else if (result.isDuplicateLead) {
        res.status(409).json({
          success: false,
          error: 'Duplicate lead detected',
          data: {
            existingLeadId: result.leadId,
            customerId: result.customerId
          },
          details: result.errors
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Lead processing failed',
          details: result.errors
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Inbound lead API error', {
        error: err.message,
        dealershipId: req.dealershipId
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process inbound lead'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/reply:
 *   post:
 *     summary: Send a reply message in a conversation
 *     description: Send agent or AI responses referencing conversation by unique ID
 *     tags: [Conversations]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReplyMessage'
 *     responses:
 *       201:
 *         description: Reply sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Invalid request payload
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
router.post('/reply',
  authenticateApiKey,
  extractDealership,
  ...apiValidation,
  validateBody(replyMessageRequestSchema),
  async (req: Request, res: Response) => {
    try {
      logger.info('Reply message API request', {
        dealershipId: req.dealershipId,
        conversationId: req.body.conversationId,
        sender: req.body.sender
      });

      const result = await conversationService.sendReply(
        req.dealershipId,
        req.body
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            messageId: result.messageId,
            conversationId: result.conversationId,
            timestamp: result.timestamp
          },
          message: 'Reply sent successfully'
        });
      } else {
        res.status(result.conversationNotFound ? 404 : 400).json({
          success: false,
          error: result.conversationNotFound ? 'Conversation not found' : 'Reply failed',
          details: result.errors
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Reply message API error', {
        error: err.message,
        dealershipId: req.dealershipId,
        conversationId: req.body.conversationId
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to send reply'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/handover:
 *   post:
 *     summary: Request a handover from AI to human agent
 *     description: Create an escalation request with required status and context
 *     tags: [Handovers]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HandoverRequest'
 *     responses:
 *       201:
 *         description: Handover created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HandoverResponse'
 *       400:
 *         description: Invalid request payload
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
router.post('/handover',
  authenticateApiKey,
  extractDealership,
  ...apiValidation,
  validateBody(handoverRequestSchema),
  async (req: Request, res: Response) => {
    try {
      logger.info('Handover request API', {
        dealershipId: req.dealershipId,
        conversationId: req.body.conversationId,
        reason: req.body.reason
      });

      const result = await handoverService.createHandover(
        req.dealershipId,
        req.body
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            handoverId: result.handoverId,
            conversationId: result.conversationId,
            status: result.status,
            estimatedResponseTime: result.estimatedResponseTime
          },
          message: 'Handover created successfully'
        });
      } else {
        res.status(result.conversationNotFound ? 404 : 400).json({
          success: false,
          error: result.conversationNotFound ? 'Conversation not found' : 'Handover failed',
          details: result.errors
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Handover API error', {
        error: err.message,
        dealershipId: req.dealershipId,
        conversationId: req.body.conversationId
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create handover'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/handover/{handoverId}:
 *   patch:
 *     summary: Update handover status
 *     description: Update the status of an existing handover (accept, reject, complete)
 *     tags: [Handovers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: handoverId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected, in_progress, resolved]
 *               userId:
 *                 type: integer
 *               notes:
 *                 type: string
 *               customerSatisfaction:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Handover updated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Handover not found
 *       500:
 *         description: Internal server error
 */
router.patch('/handover/:handoverId',
  authenticateApiKey,
  extractDealership,
  validateUuidParam('handoverId'),
  ...apiValidation,
  validateBody(handoverUpdateRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const { handoverId } = req.params;
      const updateData = req.body;

      logger.info('Handover update API', {
        dealershipId: req.dealershipId,
        handoverId,
        status: updateData.status
      });

      const result = await handoverService.updateHandover(
        req.dealershipId,
        handoverId,
        updateData
      );

      if (result.success) {
        res.json({
          success: true,
          data: result.handover,
          message: 'Handover updated successfully'
        });
      } else {
        res.status(result.handoverNotFound ? 404 : 400).json({
          success: false,
          error: result.handoverNotFound ? 'Handover not found' : 'Update failed',
          details: result.errors
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Handover update API error', {
        error: err.message,
        dealershipId: req.dealershipId,
        handoverId: req.params.handoverId
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update handover'
      });
    }
  }
);

// GET endpoints for retrieving data

/**
 * @swagger
 * /api/v1/leads:
 *   get:
 *     summary: Get leads for the dealership
 *     description: Retrieve leads with optional filtering and pagination
 *     tags: [Leads]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, contacted, qualified, proposal, negotiation, sold, lost, follow_up, archived]
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/leads',
  authenticateApiKey,
  extractDealership,
  validateQuery(leadsQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { limit = 50, offset = 0, status, source, customerId } = req.query;

      const leads = await leadService.getLeads(req.dealershipId, {
        limit: Math.min(parseInt(limit as string) || 50, 100),
        offset: parseInt(offset as string) || 0,
        status: status as string,
        source: source as string,
        customerId: customerId as string
      });

      res.json({
        success: true,
        data: leads,
        pagination: {
          limit: Math.min(parseInt(limit as string) || 50, 100),
          offset: parseInt(offset as string) || 0,
          total: leads.length
        }
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Get leads API error', {
        error: err.message,
        dealershipId: req.dealershipId
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve leads'
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/leads/{leadId}:
 *   get:
 *     summary: Get lead by ID
 *     description: Retrieve detailed information for a specific lead
 *     tags: [Leads]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lead retrieved successfully
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Internal server error
 */
router.get('/leads/:leadId',
  authenticateApiKey,
  extractDealership,
  validateUuidParam('leadId'),
  async (req: Request, res: Response) => {
    try {
      const { leadId } = req.params;

      const lead = await leadService.getLeadById(leadId, req.dealershipId);

      if (!lead) {
        return res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
      }

      res.json({
        success: true,
        data: lead
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Get lead by ID API error', {
        error: err.message,
        dealershipId: req.dealershipId,
        leadId: req.params.leadId
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve lead'
      });
    }
  }
);

export default router;