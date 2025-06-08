import { db, executeQuery } from "../db";
import logger from "../utils/logger";
import { sql } from "drizzle-orm";
import { cacheService, createCacheKey } from "./unified-cache-service";

/**
 * Optimized database access functions with caching support
 * These functions provide better performance by using indexes and caching
 */

// Cache durations (in seconds)
const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
};

/**
 * Get recent conversations with pagination
 * Uses index: idx_conversations_dealership_created
 */
export async function getRecentConversations(
  dealershipId: number,
  page: number = 1,
  limit: number = 20,
  status?: string,
) {
  const cacheKey = createCacheKey("conversations", {
    dealershipId,
    page,
    limit,
    status: status || "all",
  });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      logger.info("Cache miss - fetching conversations from database", {
        dealershipId,
        page,
        limit,
        status,
      });

      return executeQuery(async () => {
        const offset = (page - 1) * limit;

        // Build query parts
        const whereClause = status
          ? `WHERE dealership_id = $1 AND status = $2`
          : `WHERE dealership_id = $1`;

        const params = status ? [dealershipId, status] : [dealershipId];

        // Add pagination params
        params.push(limit, offset);

        // Main query
        const query = `
        SELECT 
          id, 
          customer_name, 
          customer_email, 
          customer_phone,
          status, 
          created_at, 
          updated_at,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id) as message_count
        FROM conversations
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${params.length - 1} 
        OFFSET $${params.length}
      `;

        // Total count query
        const countQuery = `
        SELECT COUNT(*) as total 
        FROM conversations 
        ${whereClause}
      `;

        // Execute both queries in parallel
        const [conversations, countResult] = await Promise.all([
          db.execute(query),
          db.execute(countQuery),
        ]);

        const total = parseInt(countResult[0]?.total || "0");

        return {
          conversations,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      });
    },
    { ttl: CACHE_TTL.SHORT },
  );
}

/**
 * Get conversation with messages
 * Uses indexes: conversation PK, idx_messages_conversation_timestamp
 */
export async function getConversationWithMessages(
  conversationId: number,
  messageLimit: number = 50,
) {
  const cacheKey = createCacheKey("conversation", {
    id: conversationId,
    limit: messageLimit,
  });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      logger.info("Cache miss - fetching conversation details", {
        conversationId,
        messageLimit,
      });

      return executeQuery(async () => {
        // Get conversation details
        const conversationQuery = `
        SELECT * FROM conversations WHERE id = $1
      `;

        // Get recent messages
        const messagesQuery = `
        SELECT 
          id, 
          content, 
          is_from_customer, 
          created_at, 
          metadata
        FROM messages 
        WHERE conversation_id = $1 
        ORDER BY created_at ASC 
        LIMIT $2
      `;

        // Execute both queries in parallel
        const [conversationResult, messages] = await Promise.all([
          db.execute(conversationQuery, [conversationId]),
          db.execute(messagesQuery, [conversationId, messageLimit]),
        ]);

        if (conversationResult.length === 0) {
          return null;
        }

        return {
          ...conversationResult[0],
          messages,
        };
      });
    },
    { ttl: CACHE_TTL.SHORT },
  );
}

/**
 * Find user by email or username for authentication
 * Uses indexes: idx_users_email, idx_users_username
 */
export async function findUserForAuth(loginIdentifier: string) {
  // Only cache this briefly as auth data should be fresh
  const cacheKey = createCacheKey("auth-user", { identifier: loginIdentifier });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      return executeQuery(async () => {
        const query = `
        SELECT 
          id, 
          username, 
          email, 
          password, 
          name, 
          role, 
          dealership_id as "dealershipId", 
          is_verified as "isVerified"
        FROM users
        WHERE email = $1 OR username = $1
        LIMIT 1
      `;

        const result = await db.execute(query, [loginIdentifier]);
        return result.length > 0 ? result[0] : null;
      });
    },
    { ttl: 10 },
  ); // Short 10 second TTL for auth data
}

/**
 * Search conversations by customer information
 * Uses indexes on customer_email, customer_phone, and full-text capabilities
 */
export async function searchConversations(
  dealershipId: number,
  searchTerm: string,
  limit: number = 20,
) {
  const cacheKey = createCacheKey("conversation-search", {
    dealershipId,
    term: searchTerm,
    limit,
  });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      logger.info("Cache miss - searching conversations", {
        dealershipId,
        searchTerm,
        limit,
      });

      return executeQuery(async () => {
        const searchPattern = `%${searchTerm}%`;

        const query = `
        SELECT 
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
        LIMIT $3
      `;

        return db.execute(query, [dealershipId, searchPattern, limit]);
      });
    },
    { ttl: CACHE_TTL.SHORT },
  );
}

/**
 * Get dealership users with filtering by role
 * Uses index: idx_users_dealership_role
 */
export async function getDealershipUsers(
  dealershipId: number,
  includeInactive: boolean = false,
) {
  const cacheKey = createCacheKey("dealership-users", {
    dealershipId,
    includeInactive,
  });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      logger.info("Cache miss - fetching dealership users", {
        dealershipId,
        includeInactive,
      });

      return executeQuery(async () => {
        // Add condition for active users only if needed
        const activeCondition = includeInactive ? "" : "AND is_active = true";

        const query = `
        SELECT 
          id, 
          username, 
          email, 
          name, 
          role, 
          is_verified as "isVerified", 
          created_at as "createdAt"
        FROM users
        WHERE dealership_id = $1 ${activeCondition}
        ORDER BY role ASC, name ASC
      `;

        return db.execute(query, [dealershipId]);
      });
    },
    { ttl: CACHE_TTL.MEDIUM },
  );
}

/**
 * Search message content using full-text search
 * Uses index: idx_messages_content_tsvector
 */
export async function searchMessageContent(
  dealershipId: number,
  searchTerm: string,
  limit: number = 20,
) {
  const cacheKey = createCacheKey("message-search", {
    dealershipId,
    term: searchTerm,
    limit,
  });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      logger.info("Cache miss - searching message content", {
        dealershipId,
        searchTerm,
        limit,
      });

      return executeQuery(async () => {
        // Convert search term to tsquery format
        const tsQuery = searchTerm.trim().split(/\s+/).join(" & ");

        const query = `
        SELECT 
          m.id, 
          m.content, 
          m.conversation_id as "conversationId", 
          m.created_at as "createdAt",
          c.customer_name as "customerName"
        FROM messages m
        INNER JOIN conversations c ON m.conversation_id = c.id
        WHERE c.dealership_id = $1
          AND to_tsvector('english', m.content) @@ to_tsquery('english', $2)
        ORDER BY m.created_at DESC
        LIMIT $3
      `;

        return db.execute(query, [dealershipId, tsQuery, limit]);
      });
    },
    { ttl: CACHE_TTL.MEDIUM },
  );
}

/**
 * Get conversation analytics over a time period
 * Optimized for dashboard display with caching
 */
export async function getConversationAnalytics(
  dealershipId: number,
  startDate: Date,
  endDate: Date,
) {
  const cacheKey = createCacheKey("conversation-analytics", {
    dealershipId,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  });

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      logger.info("Cache miss - generating conversation analytics", {
        dealershipId,
        startDate,
        endDate,
      });

      return executeQuery(async () => {
        const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_conversations,
          COUNT(DISTINCT id) FILTER (WHERE status = 'active') as active_conversations,
          COUNT(DISTINCT id) FILTER (WHERE status = 'completed') as completed_conversations
        FROM conversations 
        WHERE dealership_id = $1 
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE(created_at) 
        ORDER BY date
      `;

        return db.execute(query, [
          dealershipId,
          startDate.toISOString(),
          endDate.toISOString(),
        ]);
      });
    },
    { ttl: CACHE_TTL.LONG },
  ); // Longer cache for analytics
}

/**
 * Clear all caches related to a dealership
 * Use this when major data changes happen
 */
export function invalidateDealershipCache(dealershipId: number) {
  // Invalidate conversation caches
  cacheService.invalidatePattern(`^conversations:.*${dealershipId}`);
  cacheService.invalidatePattern(`^conversation-search:.*${dealershipId}`);
  cacheService.invalidatePattern(`^conversation-analytics:.*${dealershipId}`);

  // Invalidate user caches
  cacheService.invalidatePattern(`^dealership-users:.*${dealershipId}`);

  // Invalidate message search cache
  cacheService.invalidatePattern(`^message-search:.*${dealershipId}`);

  logger.info(`Cache invalidated for dealership: ${dealershipId}`);
}

/**
 * Clear all caches related to a conversation
 * Use this when a conversation is updated
 */
export function invalidateConversationCache(conversationId: number) {
  cacheService.delete(`conversation:${conversationId}`);

  // Also clear potentially affected list caches
  cacheService.invalidatePattern(`^conversations:`);

  logger.info(`Cache invalidated for conversation: ${conversationId}`);
}

/**
 * Get basic database statistics for monitoring
 */
export async function getDatabaseStats() {
  // This is admin-only data so we use a shorter cache
  return cacheService.getOrSet(
    "database-stats",
    async () => {
      return executeQuery(async () => {
        const queries = [
          // Table row counts
          `SELECT 'conversations' as table_name, COUNT(*) as row_count FROM conversations`,
          `SELECT 'messages' as table_name, COUNT(*) as row_count FROM messages`,
          `SELECT 'users' as table_name, COUNT(*) as row_count FROM users`,

          // Index usage
          `SELECT 
          schemaname, 
          relname as table_name, 
          indexrelname as index_name, 
          idx_scan as used_count
        FROM 
          pg_stat_user_indexes
        ORDER BY 
          idx_scan DESC
        LIMIT 10`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.execute(query)),
        );

        return {
          tableCounts: [...results[0], ...results[1], ...results[2]],
          indexUsage: results[3],
        };
      });
    },
    { ttl: 300 },
  ); // 5 minute cache
}
