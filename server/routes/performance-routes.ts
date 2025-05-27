import { Request, Response } from 'express';
import express from 'express';
import { sql } from 'drizzle-orm';
import { executeQuery } from '../db';
import db from '../db';
import { cacheService, createCacheKey } from '../services/unified-cache-service';
import logger from '../utils/logger';

const router = express.Router();

// Cached conversations endpoint with pagination
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1; // Default for development
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;

    // Create a cache key based on the query parameters
    const cacheKey = createCacheKey('conversations', {
      dealershipId,
      page,
      limit,
      status: status || 'all'
    });

    // Try to get from cache first, or compute if not available
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Cache miss - fetching conversations from database', {
          dealershipId,
          page,
          limit,
          status
        });

        // Use executeQuery with retry logic for better reliability
        return await executeQuery(async () => {
          // Build SQL query with proper parameterization
          let queryText = `
            SELECT
              c.id,
              c.customer_name,
              c.customer_email,
              c.customer_phone,
              c.status,
              c.created_at,
              c.updated_at,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
            FROM conversations c
            WHERE c.dealership_id = $1
          `;

          const queryParams: any[] = [dealershipId];

          if (status) {
            queryText += ` AND c.status = $2`;
            queryParams.push(status);
          }

          queryText += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
          queryParams.push(limit, (page - 1) * limit);

          // Get conversations
          const conversations = await db.execute(queryText, queryParams);

          // Get total count for pagination
          let countQuery = `
            SELECT COUNT(*) as total
            FROM conversations
            WHERE dealership_id = $1
          `;

          const countParams = [dealershipId];

          if (status) {
            countQuery += ` AND status = $2`;
            countParams.push(status);
          }

          const totalResult = await db.execute(countQuery, countParams);
          const total = parseInt(totalResult[0].total);

          return {
            conversations,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          };
        });
      },
      { ttl: 60 } // Cache for 60 seconds
    );

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

// Get single conversation with messages (cached)
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const messageLimit = Number(req.query.messageLimit) || 50;

    // Create cache key
    const cacheKey = createCacheKey('conversation-detail', {
      id: conversationId,
      messageLimit
    });

    // Try to get from cache first, or compute if not available
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Cache miss - fetching conversation details from database', {
          conversationId,
          messageLimit
        });

        return await executeQuery(async () => {
          // Get conversation details
          const conversation = await sql.raw(
            `SELECT * FROM conversations WHERE id = $1`,
            [conversationId]
          );

          if (conversation.length === 0) {
            return null;
          }

          // Get messages for this conversation
          const messages = await sql.raw(
            `SELECT
              id,
              content,
              is_from_customer,
              created_at,
              metadata
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            LIMIT $2`,
            [conversationId, messageLimit]
          );

          return {
            ...conversation[0],
            messages
          };
        });
      },
      { ttl: 30 } // Cache for 30 seconds
    );

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

// Search conversations by customer info (cached)
router.get('/search', async (req, res) => {
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

    // Create cache key
    const cacheKey = createCacheKey('conversation-search', {
      dealershipId,
      term: searchTerm,
      limit
    });

    // Cache search results for a shorter time as they may change frequently
    const results = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Cache miss - searching conversations in database', {
          dealershipId,
          searchTerm,
          limit
        });

        return await executeQuery(async () => {
          const searchPattern = `%${searchTerm}%`;

          return await db.execute(
            `SELECT
              id,
              customer_name,
              customer_email,
              customer_phone,
              status,
              created_at
            FROM conversations
            WHERE dealership_id = $1
              AND (
                customer_name ILIKE $2 OR
                customer_email ILIKE $2 OR
                customer_phone ILIKE $2
              )
            ORDER BY created_at DESC
            LIMIT $3`,
            [dealershipId, searchPattern, limit]
          );
        });
      },
      { ttl: 20 } // Cache for 20 seconds
    );

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

// Get analytics for conversations (cached longer as analytics change less frequently)
router.get('/analytics', async (req, res) => {
  try {
    const dealershipId = Number(req.query.dealershipId) || 1;
    const days = Number(req.query.days) || 30;

    // Create cache key
    const cacheKey = createCacheKey('conversation-analytics', {
      dealershipId,
      days
    });

    // Analytics can be cached longer as they change less frequently
    const analytics = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Cache miss - generating conversation analytics', {
          dealershipId,
          days
        });

        return await executeQuery(async () => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          return await db.execute(
            `SELECT
              DATE(created_at) as date,
              COUNT(*) as total_conversations,
              COUNT(DISTINCT id) FILTER (WHERE status = 'active') as active_conversations,
              COUNT(DISTINCT id) FILTER (WHERE status = 'completed') as completed_conversations
            FROM conversations
            WHERE dealership_id = $1
              AND created_at >= $2
            GROUP BY DATE(created_at)
            ORDER BY date`,
            [dealershipId, startDate.toISOString()]
          );
        });
      },
      { ttl: 3600 } // Cache for 1 hour
    );

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

// Clear cache endpoints (for admin use)
router.post('/cache/clear', (req, res) => {
  const pattern = req.body.pattern;

  if (pattern) {
    cacheService.invalidatePattern(pattern);
    logger.info(`Cache cleared by pattern: ${pattern}`);
  } else {
    cacheService.clear();
    logger.info('Entire cache cleared');
  }

  res.json({
    success: true,
    message: pattern ? `Cache cleared by pattern: ${pattern}` : 'Entire cache cleared'
  });
});

// Get cache stats
router.get('/cache/stats', (req, res) => {
  const stats = cacheService.getStats();
  res.json({
    success: true,
    data: stats
  });
});

export default router;