import express from 'express';
import logger from '../utils/logger';
import { cacheService } from '../services/unified-cache-service';
import {
  getRecentConversations,
  getConversationWithMessages,
  searchConversations,
  getDealershipUsers,
  searchMessageContent,
  getConversationAnalytics,
  getDatabaseStats,
  invalidateDealershipCache,
  invalidateConversationCache
} from '../services/optimized-db';

const router = express.Router();

/**
 * Optimized API routes with caching and performance improvements
 */

// Get paginated conversations list
router.get('/conversations', async (req, res) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1; // Default for development
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;

    const result = await getRecentConversations(dealershipId, page, limit, status);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch conversations', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// Get single conversation with messages
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const messageLimit = Number(req.query.messageLimit) || 50;

    const result = await getConversationWithMessages(conversationId, messageLimit);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch conversation details', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation details'
    });
  }
});

// Search conversations by customer info
router.get('/search/conversations', async (req, res) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1;
    const searchTerm = req.query.term as string;
    const limit = Number(req.query.limit) || 20;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    const results = await searchConversations(dealershipId, searchTerm, limit);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to search conversations', err);
    res.status(500).json({
      success: false,
      error: 'Failed to search conversations'
    });
  }
});

// Search messages content
router.get('/search/messages', async (req, res) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1;
    const searchTerm = req.query.term as string;
    const limit = Number(req.query.limit) || 20;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }

    const results = await searchMessageContent(dealershipId, searchTerm, limit);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to search message content', err);
    res.status(500).json({
      success: false,
      error: 'Failed to search message content'
    });
  }
});

// Get dealership users
router.get('/users', async (req, res) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1;
    const includeInactive = req.query.includeInactive === 'true';

    const users = await getDealershipUsers(dealershipId, includeInactive);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch dealership users', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dealership users'
    });
  }
});

// Get conversation analytics for dashboard
router.get('/analytics/conversations', async (req, res) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1;
    const days = Number(req.query.days) || 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await getConversationAnalytics(dealershipId, startDate, endDate);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to generate analytics', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics'
    });
  }
});

// Admin only - get database stats
router.get('/admin/db-stats', async (req, res) => {
  try {
    // Check for admin role (simple implementation, enhance as needed)
    const isAdmin = req.query.admin_key === process.env.ADMIN_API_KEY || 
                   (req.user && req.user.role === 'admin');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const stats = await getDatabaseStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to fetch database stats', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch database stats'
    });
  }
});

// Cache management - clear cache for a dealership
router.post('/cache/clear/dealership/:id', async (req, res) => {
  try {
    const dealershipId = Number(req.params.id);
    
    invalidateDealershipCache(dealershipId);
    
    res.json({
      success: true,
      message: `Cache cleared for dealership: ${dealershipId}`
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to clear dealership cache', err);
    res.status(500).json({
      success: false,
      error: 'Failed to clear dealership cache'
    });
  }
});

// Cache management - clear cache for a conversation
router.post('/cache/clear/conversation/:id', async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    
    invalidateConversationCache(conversationId);
    
    res.json({
      success: true,
      message: `Cache cleared for conversation: ${conversationId}`
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to clear conversation cache', err);
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation cache'
    });
  }
});

// Get cache statistics
router.get('/cache/stats', (req, res) => {
  try {
    const stats = cacheService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get cache stats', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

// Clear entire cache (admin only)
router.post('/cache/clear/all', (req, res) => {
  try {
    // Check for admin role (simple implementation, enhance as needed)
    const isAdmin = req.query.admin_key === process.env.ADMIN_API_KEY || 
                   (req.user && req.user.role === 'admin');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    cacheService.clear();
    
    res.json({
      success: true,
      message: 'Entire cache cleared'
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to clear entire cache', err);
    res.status(500).json({
      success: false,
      error: 'Failed to clear entire cache'
    });
  }
});

export default router;