import { Router } from 'express';
import { conversationLogsService, type ConversationLogFilters } from '../services/conversation-logs-service';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/conversation-logs
 * Get conversation logs with filtering and pagination
 * @description Retrieve conversation logs with optional filtering and pagination
 * @tags Conversations
 * @security Session
 * @param {integer} dealershipId.query.required - Dealership ID
 * @param {string} status.query - Filter by conversation status (comma-separated)
 * @param {integer} assignedUserId.query - Filter by assigned user ID
 * @param {boolean} escalatedOnly.query - Filter to only show escalated conversations
 * @param {string} dateFrom.query - Filter by start date (ISO format)
 * @param {string} dateTo.query - Filter by end date (ISO format)
 * @param {string} searchTerm.query - Search term for filtering conversations
 * @param {integer} limit.query - Maximum number of logs to return - default: 50
 * @param {integer} offset.query - Number of logs to skip - default: 0
 * @param {string} sortBy.query - Field to sort by - default: last_message_at
 * @param {string} sortOrder.query - Sort order (asc or desc) - default: desc
 * @returns {object} 200 - Conversation logs retrieved successfully
 * @throws {401} Authentication required - User is not authenticated
 * @throws {400} Invalid request - Missing required parameters
 * @throws {500} Internal server error - Server processing error
 */
router.get('/', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      dealershipId,
      status,
      assignedUserId,
      escalatedOnly,
      dateFrom,
      dateTo,
      searchTerm,
      limit = '50',
      offset = '0',
      sortBy = 'last_message_at',
      sortOrder = 'desc'
    } = req.query;

    if (!dealershipId) {
      return res.status(400).json({ error: 'Dealership ID is required' });
    }

    const filters: ConversationLogFilters = {
      dealershipId: parseInt(dealershipId as string),
      status: status ? (status as string).split(',') as any : undefined,
      assignedUserId: assignedUserId ? parseInt(assignedUserId as string) : undefined,
      escalatedOnly: escalatedOnly === 'true',
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      searchTerm: searchTerm as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    };

    const result = await conversationLogsService.getConversationLogs(filters);

    logger.info('Conversation logs retrieved', {
      dealershipId: filters.dealershipId,
      total: result.total,
      returned: result.logs.length
    });

    res.json({
      success: true,
      logs: result.logs,
      total: result.total,
      analytics: result.analytics,
      filters: {
        ...filters,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error fetching conversation logs:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation logs',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

/**
 * GET /api/conversation-logs/{conversationId}
 * Get detailed conversation with full message history
 * @description Retrieve detailed conversation information including all messages
 * @tags Conversations
 * @security Session
 * @param {string} conversationId.path.required - Conversation UUID
 * @param {integer} dealershipId.query.required - Dealership ID
 * @returns {object} 200 - Detailed conversation retrieved successfully
 * @throws {401} Authentication required - User is not authenticated
 * @throws {400} Invalid request - Missing required parameters
 * @throws {404} Conversation not found - The specified conversation does not exist
 * @throws {500} Internal server error - Server processing error
 */
router.get('/:conversationId', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { conversationId } = req.params;
    const { dealershipId } = req.query;

    if (!dealershipId) {
      return res.status(400).json({ error: 'Dealership ID is required' });
    }

    const result = await conversationLogsService.getDetailedConversation(
      conversationId,
      parseInt(dealershipId as string)
    );

    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    logger.info('Detailed conversation retrieved', {
      conversationId,
      messageCount: result.messages.length,
      escalationCount: result.escalations.length
    });

    res.json({
      success: true,
      conversation: result.conversation,
      messages: result.messages,
      escalations: result.escalations
    });

  } catch (error: any) {
    logger.error('Error fetching detailed conversation:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation details',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

/**
 * GET /api/conversation-logs/analytics/summary
 * Get conversation analytics
 * @description Retrieve analytics and summary data for conversations
 * @tags Analytics
 * @security Session
 * @param {integer} dealershipId.query.required - Dealership ID
 * @param {string} dateFrom.query - Filter by start date (ISO format)
 * @param {string} dateTo.query - Filter by end date (ISO format)
 * @returns {object} 200 - Conversation analytics retrieved successfully
 * @throws {401} Authentication required - User is not authenticated
 * @throws {400} Invalid request - Missing required parameters
 * @throws {500} Internal server error - Server processing error
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { dealershipId, dateFrom, dateTo } = req.query;

    if (!dealershipId) {
      return res.status(400).json({ error: 'Dealership ID is required' });
    }

    const analytics = await conversationLogsService.getAnalytics(
      parseInt(dealershipId as string),
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined
    );

    logger.info('Conversation analytics retrieved', {
      dealershipId,
      totalConversations: analytics.totalConversations
    });

    res.json({
      success: true,
      analytics,
      dateRange: {
        from: dateFrom ? new Date(dateFrom as string).toISOString() : null,
        to: dateTo ? new Date(dateTo as string).toISOString() : null
      }
    });

  } catch (error: any) {
    logger.error('Error fetching conversation analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

/**
 * POST /api/conversation-logs/export
 * Export conversation data
 * @description Export conversation logs data in specified format
 * @tags Conversations
 * @security Session
 * @requestBody {object} required - Export filters and format
 * @returns {object} 200 - Conversation logs exported successfully
 * @throws {401} Authentication required - User is not authenticated
 * @throws {400} Invalid request - Missing required parameters
 * @throws {500} Internal server error - Server processing error
 */
router.post('/export', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { filters, format = 'json' } = req.body;

    if (!filters || !filters.dealershipId) {
      return res.status(400).json({ error: 'Filters with dealership ID are required' });
    }

    // Convert filters
    const exportFilters: ConversationLogFilters = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
      limit: 1000 // Set a reasonable limit for exports
    };

    const result = await conversationLogsService.getConversationLogs(exportFilters);

    if (format === 'csv') {
      // TODO: Implement CSV export
      res.status(501).json({ error: 'CSV export not yet implemented' });
      return;
    }

    logger.info('Conversation logs exported', {
      dealershipId: filters.dealershipId,
      format,
      total: result.total
    });

    res.json({
      success: true,
      data: result.logs,
      total: result.total,
      format,
      exportedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error exporting conversation logs:', error);
    res.status(500).json({
      error: 'Failed to export conversation logs',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

export default router;