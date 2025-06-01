/**
 * ADF Conversation API Routes
 * Provides endpoints for the customer conversation viewing dashboard
 */

import { Router, Request, Response } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { authenticateSession, requireDealershipAccess } from '../middleware/auth';
import { conversationService } from '../services/conversation-service';
import logger from '../utils/logger';
import { ApiError } from '../utils/error-handler';
import { sendError, sendValidationError, sendSuccess, sendNotFound, sendForbidden } from '../utils/api-response';
import { wsServer } from '../ws-server';

const router = Router();

// Apply authentication to all routes
router.use(authenticateSession);

/**
 * @route GET /api/adf/conversations
 * @desc List conversations with pagination and filtering
 * @access Private (dealership users only)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isString(),
    query('channel').optional().isString(),
    query('source').optional().isString(),
    query('search').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('sortBy').optional().isString(),
    query('sortDirection').optional().isIn(['asc', 'desc']),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      if (!dealershipId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      // Parse query parameters
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = (page - 1) * limit;

      // Parse filters
      const filters: any = {};
      
      if (req.query.status) {
        filters.status = (req.query.status as string).split(',');
      }
      
      if (req.query.channel) {
        filters.channel = (req.query.channel as string).split(',');
      }
      
      if (req.query.source) {
        filters.source = (req.query.source as string).split(',');
      }
      
      if (req.query.search) {
        filters.search = req.query.search as string;
      }
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      // Set pagination options
      const paginationOptions = {
        limit,
        offset,
        sortBy: req.query.sortBy as string || 'lastActivityAt',
        sortDirection: req.query.sortDirection as 'asc' | 'desc' || 'desc'
      };

      // Get conversations
      const result = await conversationService.listConversations(
        dealershipId,
        filters,
        paginationOptions
      );

      return res.json(formatApiResponse({
        success: true,
        data: {
          conversations: result.conversations,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit)
        }
      }));
    } catch (error) {
      logger.error('Error listing conversations', { error, userId: req.user?.id });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to list conversations'
      }));
    }
  }
);

/**
 * @route GET /api/adf/conversations/stats
 * @desc Get conversation statistics for dashboard
 * @access Private (dealership users only)
 */
router.get(
  '/stats',
  [
    query('timeframe').optional().isIn(['day', 'week', 'month']),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      if (!dealershipId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      // Parse timeframe
      const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

      // Get conversation stats
      const stats = await conversationService.getConversationStats(dealershipId, timeframe);

      return res.json(formatApiResponse({
        success: true,
        data: stats
      }));
    } catch (error) {
      logger.error('Error getting conversation stats', { error, userId: req.user?.id });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to get conversation statistics'
      }));
    }
  }
);

/**
 * @route GET /api/adf/conversations/:id
 * @desc Get conversation details
 * @access Private (dealership users only)
 */
router.get(
  '/:id',
  [
    param('id').isInt().toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      if (!dealershipId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      const conversationId = parseInt(req.params.id, 10);

      // Get conversation details
      const conversation = await conversationService.getConversationById(conversationId, dealershipId);

      if (!conversation) {
        return res.status(404).json(formatApiResponse({
          success: false,
          error: 'not_found',
          message: 'Conversation not found'
        }));
      }

      return res.json(formatApiResponse({
        success: true,
        data: conversation
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode || 500).json(formatApiResponse({
          success: false,
          error: error.code || 'server_error',
          message: error.message
        }));
      }

      logger.error('Error getting conversation details', { 
        error, 
        userId: req.user?.id,
        conversationId: req.params.id
      });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to get conversation details'
      }));
    }
  }
);

/**
 * @route GET /api/adf/conversations/:id/messages
 * @desc Get conversation messages with pagination
 * @access Private (dealership users only)
 */
router.get(
  '/:id/messages',
  [
    param('id').isInt().toInt(),
    query('cursor').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('direction').optional().isIn(['before', 'after']),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      if (!dealershipId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      const conversationId = parseInt(req.params.id, 10);

      // Verify conversation belongs to dealership
      await conversationService.verifyConversationAccess(conversationId, dealershipId);

      // Set cursor pagination options
      const options = {
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        cursor: req.query.cursor as string | undefined,
        direction: (req.query.direction as 'before' | 'after') || 'before',
        messageType: req.query.messageType as string | undefined
      };

      // Get messages with cursor-based pagination
      const result = await conversationService.getConversationMessagesWithCursor(
        conversationId,
        options
      );

      return res.json(formatApiResponse({
        success: true,
        data: {
          messages: result.messages,
          nextCursor: result.nextCursor,
          prevCursor: result.prevCursor
        }
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode || 500).json(formatApiResponse({
          success: false,
          error: error.code || 'server_error',
          message: error.message
        }));
      }

      logger.error('Error getting conversation messages', { 
        error, 
        userId: req.user?.id,
        conversationId: req.params.id
      });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to get conversation messages'
      }));
    }
  }
);

/**
 * @route GET /api/adf/conversations/:id/lead-context
 * @desc Get lead context information for a conversation
 * @access Private (dealership users only)
 */
router.get(
  '/:id/lead-context',
  [
    param('id').isInt().toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      if (!dealershipId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      const conversationId = parseInt(req.params.id, 10);

      // Verify conversation belongs to dealership
      const conversation = await conversationService.getConversationById(conversationId, dealershipId);

      if (!conversation) {
        return res.status(404).json(formatApiResponse({
          success: false,
          error: 'not_found',
          message: 'Conversation not found'
        }));
      }

      // If no ADF lead ID, return empty context
      if (!conversation.adfLeadId) {
        return res.json(formatApiResponse({
          success: true,
          data: null
        }));
      }

      // Get lead context
      const leadContext = await conversationService.getLeadContext(conversation.adfLeadId);

      return res.json(formatApiResponse({
        success: true,
        data: leadContext
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode || 500).json(formatApiResponse({
          success: false,
          error: error.code || 'server_error',
          message: error.message
        }));
      }

      logger.error('Error getting lead context', { 
        error, 
        userId: req.user?.id,
        conversationId: req.params.id
      });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to get lead context'
      }));
    }
  }
);

/**
 * @route POST /api/adf/conversations/:id/events
 * @desc Log conversation events (status changes, handovers, etc.)
 * @access Private (dealership users only)
 */
router.post(
  '/:id/events',
  [
    param('id').isInt().toInt(),
    body('eventType').isString().isIn([
      'status_change', 
      'handover', 
      'completed', 
      'reopened', 
      'note_added', 
      'user_assigned'
    ]),
    body('notes').optional().isString(),
    body('metadata').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID and user ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      const userId = req.user?.id;
      
      if (!dealershipId || !userId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      const conversationId = parseInt(req.params.id, 10);

      // Verify conversation belongs to dealership
      await conversationService.verifyConversationAccess(conversationId, dealershipId);

      // Log the event
      const eventId = await conversationService.logConversationEvent(
        conversationId,
        req.body.eventType,
        userId,
        req.body.notes
      );

      // Send WebSocket notification
      wsServer.publishToChannel(`dealership/${dealershipId}/conversations`, {
        type: 'conversation_updated',
        conversationId,
        eventType: req.body.eventType,
        timestamp: new Date().toISOString()
      });

      return res.json(formatApiResponse({
        success: true,
        data: {
          eventId,
          conversationId,
          eventType: req.body.eventType
        }
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode || 500).json(formatApiResponse({
          success: false,
          error: error.code || 'server_error',
          message: error.message
        }));
      }

      logger.error('Error logging conversation event', { 
        error, 
        userId: req.user?.id,
        conversationId: req.params.id,
        eventType: req.body.eventType
      });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to log conversation event'
      }));
    }
  }
);

/**
 * @route POST /api/adf/conversations/:id/status
 * @desc Update conversation status
 * @access Private (dealership users only)
 */
router.post(
  '/:id/status',
  [
    param('id').isInt().toInt(),
    body('status').isString().isIn(['active', 'completed', 'handover', 'new']),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array().map(err => ({
          field: err.path || 'unknown',
          message: err.msg,
          code: err.type
        })));
      }

      // Get dealership ID and user ID from authenticated user
      const dealershipId = req.user?.dealershipId;
      const userId = req.user?.id;
      
      if (!dealershipId || !userId) {
        return res.status(403).json(formatApiResponse({
          success: false,
          error: 'access_denied',
          message: 'Dealership access required'
        }));
      }

      const conversationId = parseInt(req.params.id, 10);
      const { status } = req.body;

      // Verify conversation belongs to dealership
      await conversationService.verifyConversationAccess(conversationId, dealershipId);

      // Update status
      await conversationService.updateConversationStatus(conversationId, status);

      // Log the event
      await conversationService.logConversationEvent(
        conversationId,
        'status_change',
        userId,
        `Status changed to ${status}`
      );

      // Send WebSocket notification
      wsServer.publishToChannel(`dealership/${dealershipId}/conversations`, {
        type: 'conversation_updated',
        conversationId,
        status,
        timestamp: new Date().toISOString()
      });

      return res.json(formatApiResponse({
        success: true,
        data: {
          conversationId,
          status
        }
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode || 500).json(formatApiResponse({
          success: false,
          error: error.code || 'server_error',
          message: error.message
        }));
      }

      logger.error('Error updating conversation status', { 
        error, 
        userId: req.user?.id,
        conversationId: req.params.id,
        status: req.body.status
      });
      
      return res.status(500).json(formatApiResponse({
        success: false,
        error: 'server_error',
        message: 'Failed to update conversation status'
      }));
    }
  }
);

export default router;
