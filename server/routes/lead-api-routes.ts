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
} from '../../shared/index';
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
 * POST /api/v1/inbound
 * Create a new inbound lead
 * @description Accept parsed lead data from various sources with strict schema validation
 * @tags Leads
 * @security ApiKeyAuth
 * @requestBody {InboundLead} required - Lead information
 * @returns {LeadCreationResponse} 201 - Lead created successfully
 * @throws {400} Invalid request payload - Validation errors
 * @throws {409} Duplicate lead detected - Lead already exists
 * @throws {500} Internal server error - Server processing error
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
 * POST /api/v1/reply
 * Send a reply message in a conversation
 * @description Send agent or AI responses referencing conversation by unique ID
 * @tags Conversations
 * @security ApiKeyAuth
 * @requestBody {ReplyMessage} required - Message content and metadata
 * @returns {MessageResponse} 201 - Reply sent successfully
 * @throws {400} Invalid request payload - Validation errors
 * @throws {404} Conversation not found - The specified conversation does not exist
 * @throws {500} Internal server error - Server processing error
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
 * POST /api/v1/handover
 * Request a handover from AI to human agent
 * @description Create an escalation request with required status and context
 * @tags Handovers
 * @security ApiKeyAuth
 * @requestBody {HandoverRequest} required - Handover details and reason
 * @returns {HandoverResponse} 201 - Handover created successfully
 * @throws {400} Invalid request payload - Validation errors
 * @throws {404} Conversation not found - The specified conversation does not exist
 * @throws {500} Internal server error - Server processing error
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
 * PATCH /api/v1/handover/{handoverId}
 * Update handover status
 * @description Update the status of an existing handover (accept, reject, complete)
 * @tags Handovers
 * @security ApiKeyAuth
 * @param {string} handoverId.path.required - Handover UUID
 * @requestBody {HandoverUpdateRequest} required - Status update information
 * @returns {object} 200 - Handover updated successfully
 * @throws {400} Invalid request - Validation errors
 * @throws {404} Handover not found - The specified handover does not exist
 * @throws {500} Internal server error - Server processing error
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
 * GET /api/v1/leads
 * Get leads for the dealership
 * @description Retrieve leads with optional filtering and pagination
 * @tags Leads
 * @security ApiKeyAuth
 * @param {integer} limit.query - Maximum number of leads to return (1-100) - default: 50
 * @param {integer} offset.query - Number of leads to skip - default: 0
 * @param {string} status.query - Filter by lead status - enum: new, contacted, qualified, proposal, negotiation, sold, lost, follow_up, archived
 * @param {string} source.query - Filter by lead source
 * @returns {LeadListResponse} 200 - Leads retrieved successfully
 * @throws {500} Internal server error - Server processing error
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
 * GET /api/v1/leads/{leadId}
 * Get lead by ID
 * @description Retrieve detailed information for a specific lead
 * @tags Leads
 * @security ApiKeyAuth
 * @param {string} leadId.path.required - Lead UUID
 * @returns {LeadDetailResponse} 200 - Lead retrieved successfully
 * @throws {404} Lead not found - The specified lead does not exist
 * @throws {500} Internal server error - Server processing error
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