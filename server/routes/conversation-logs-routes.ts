import { Router } from 'express';
import { conversationLogsService, type ConversationLogFilters } from '../services/conversation-logs-service';
import logger from '../utils/logger';

const router = Router();

// Get conversation logs with filtering and pagination
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

// Get detailed conversation with full message history
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

// Get conversation analytics
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

// Export conversation data
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