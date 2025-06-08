import { Request, Response } from "express";
import express from "express";
import { sql } from "drizzle-orm";
import db, { executeQuery } from "../db"; // Assuming executeQuery handles retries/logging
import {
  cacheService,
  createCacheKey,
  CacheEventType,
} from "../services/unified-cache-service";
import logger from "../utils/logger";
import {
  ResponseHelper,
  asyncHandler,
  AppError,
  ErrorCode,
} from "../utils/error-codes";

const router = express.Router();

const KPI_CACHE_TTL = 30; // 30 seconds for H6 KPI queries
const KPI_CACHE_TAG_PREFIX = "kpi";

// Helper to create a dealership-specific tag
const dealershipTag = (dealershipId: number | string) =>
  `dealership_${dealershipId}`;
// Helper to create a status-specific tag
const statusTag = (status?: string | null) => `status_${status || "all"}`;

// Cached conversations endpoint with pagination
router.get(
  "/conversations",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const traceId = (req as any).traceId || "unknown-trace";

    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
        { traceId },
      );
    }

    const cacheKeyOptions = {
      dealershipId,
      page,
      limit,
      status: status || "all",
    };
    const cacheKey = createCacheKey("conversations_list", cacheKeyOptions);
    const tags = [
      "conversations_list",
      dealershipTag(dealershipId),
      statusTag(status),
    ];

    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching conversations from database", {
          ...cacheKeyOptions,
          traceId,
        });

        return await executeQuery(
          async () => {
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
              queryText += ` AND c.status = $${queryParams.length + 1}`;
              queryParams.push(status);
            }

            queryText += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
            queryParams.push(limit, (page - 1) * limit);

            const conversations = await db.execute(
              sql.raw(queryText, ...queryParams),
            );

            let countQueryText = `
          SELECT COUNT(*) as total
          FROM conversations
          WHERE dealership_id = $1
        `;
            const countParams: any[] = [dealershipId];
            if (status) {
              countQueryText += ` AND status = $${countParams.length + 1}`;
              countParams.push(status);
            }
            const totalResult = await db.execute(
              sql.raw(countQueryText, ...countParams),
            );
            const total = parseInt((totalResult[0] as any)?.total || "0");

            return {
              conversations,
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
            };
          },
          { traceId },
        );
      },
      { ttl: 60, tags }, // Cache for 60 seconds, not marked as kpi:true unless specified
    );

    ResponseHelper.success(
      res,
      result,
      "Conversations retrieved successfully.",
    );
  }),
);

// Get single conversation with messages (cached)
router.get(
  "/conversations/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const conversationId = Number(req.params.id);
    const messageLimit = Number(req.query.messageLimit) || 50;
    const traceId = (req as any).traceId || "unknown-trace";

    if (isNaN(conversationId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "Conversation ID must be a number.",
        { traceId },
      );
    }

    const cacheKeyOptions = { id: conversationId, messageLimit };
    const cacheKey = createCacheKey("conversation_detail", cacheKeyOptions);
    const tags = ["conversation_detail", `conversation_${conversationId}`];

    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info(
          "Cache miss - fetching conversation details from database",
          { ...cacheKeyOptions, traceId },
        );

        return await executeQuery(
          async () => {
            const conversationResult = await db.execute(
              sql.raw(
                `SELECT * FROM conversations WHERE id = $1`,
                conversationId,
              ),
            );

            const conversation = conversationResult[0] as any;

            if (!conversation) {
              return null; // Will be handled by the check below
            }

            const messages = await db.execute(
              sql.raw(
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
                conversationId,
                messageLimit,
              ),
            );

            return {
              ...conversation,
              messages,
            };
          },
          { traceId },
        );
      },
      { ttl: 30, tags }, // Cache for 30 seconds
    );

    if (!result) {
      throw new AppError(ErrorCode.NOT_FOUND, "Conversation not found.", {
        traceId,
        conversationId,
      });
    }

    ResponseHelper.success(
      res,
      result,
      "Conversation details retrieved successfully.",
    );
  }),
);

// Search conversations by customer info (cached)
router.get(
  "/search",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    const searchTerm = req.query.term as string;
    const limit = Number(req.query.limit) || 20;
    const traceId = (req as any).traceId || "unknown-trace";

    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
        { traceId },
      );
    }
    if (!searchTerm) {
      throw new AppError(ErrorCode.INVALID_INPUT, "Search term is required.", {
        traceId,
      });
    }

    const cacheKeyOptions = { dealershipId, term: searchTerm, limit };
    const cacheKey = createCacheKey("conversation_search", cacheKeyOptions);
    const tags = ["conversation_search", dealershipTag(dealershipId)];

    const results = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - searching conversations in database", {
          ...cacheKeyOptions,
          traceId,
        });

        return await executeQuery(
          async () => {
            const searchPattern = `%${searchTerm}%`;
            return await db.execute(
              sql.raw(
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
                dealershipId,
                searchPattern,
                limit,
              ),
            );
          },
          { traceId },
        );
      },
      { ttl: 20, tags }, // Cache for 20 seconds
    );

    ResponseHelper.success(
      res,
      results,
      "Search results retrieved successfully.",
    );
  }),
);

// Get analytics for conversations (cached longer as analytics change less frequently)
router.get(
  "/analytics",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    const days = Number(req.query.days) || 30;
    const traceId = (req as any).traceId || "unknown-trace";

    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
        { traceId },
      );
    }

    const cacheKeyOptions = { dealershipId, days };
    const cacheKey = createCacheKey("conversation_analytics", cacheKeyOptions);
    // This is a KPI, use KPI prefix and relevant tags
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      "analytics",
      "conversation_analytics",
      dealershipTag(dealershipId),
    ];

    const analytics = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - generating conversation analytics (KPI)", {
          ...cacheKeyOptions,
          traceId,
        });

        return await executeQuery(
          async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            return await db.execute(
              sql.raw(
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
                dealershipId,
                startDate.toISOString(),
              ),
            );
          },
          { traceId },
        );
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags }, // Use KPI_CACHE_TTL (30s) and mark as KPI
    );

    ResponseHelper.success(
      res,
      analytics,
      "Conversation analytics retrieved successfully.",
    );
  }),
);

// Clear cache endpoints (for admin use)
router.post(
  "/cache/clear",
  asyncHandler(async (req: Request, res: Response) => {
    const { pattern, prefix, tag } = req.body;
    const traceId = (req as any).traceId || "unknown-trace";

    if (tag) {
      await cacheService.invalidateTag(tag);
      logger.info(`Cache cleared by tag: ${tag}`, { traceId });
      ResponseHelper.success(
        res,
        { invalidatedTag: tag },
        `Cache cleared by tag: ${tag}`,
      );
    } else if (pattern) {
      await cacheService.invalidatePattern(pattern, { prefix });
      logger.info(`Cache cleared by pattern: ${pattern}`, { prefix, traceId });
      ResponseHelper.success(
        res,
        { invalidatedPattern: pattern, prefix },
        `Cache cleared by pattern: ${pattern}`,
      );
    } else {
      await cacheService.clear(prefix);
      logger.info("Cache cleared", { prefix: prefix || "all", traceId });
      ResponseHelper.success(
        res,
        { clearedPrefix: prefix || "all" },
        prefix ? `Cache cleared for prefix: ${prefix}` : "Entire cache cleared",
      );
    }
  }),
);

// Get cache stats
router.get(
  "/cache/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const traceId = (req as any).traceId || "unknown-trace";
    try {
      const stats = await cacheService.getInfo(); // Use getInfo for more detailed stats
      ResponseHelper.success(
        res,
        stats,
        "Cache statistics retrieved successfully.",
      );
    } catch (error) {
      // This path should ideally not be hit if cacheService.getInfo() is robust
      // but as a fallback:
      logger.error("Failed to get cache stats from getInfo", error, {
        traceId,
      });
      const basicStats = cacheService.getStats(); // Fallback to basic stats
      ResponseHelper.success(
        res,
        basicStats,
        "Basic cache statistics retrieved (getInfo failed).",
      );
    }
  }),
);

export default router;
