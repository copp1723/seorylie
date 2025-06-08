import express, { Request, Response } from "express";
import { sql } from "drizzle-orm";
import db, { executeQuery } from "../db";
import {
  cacheService,
  createCacheKey,
  CacheEventType,
} from "../services/unified-cache-service";
import logger from "../utils/logger";
import { monitoring, ComponentHealthStatus } from "../services/monitoring";
import {
  ResponseHelper,
  asyncHandler,
  AppError,
  ErrorCode,
} from "../utils/error-codes"; // Assuming AppError and ErrorCode exist

const router = express.Router();

const KPI_CACHE_TTL = 30; // Default 30 seconds for KPI queries
const KPI_CACHE_TAG_PREFIX = "kpi";

// Helper to create a dealership-specific tag
const dealershipTag = (dealershipId: number | string) =>
  `dealership_${dealershipId}`;

// --- Conversation Analytics KPIs ---

router.get(
  "/conversations/summary",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
      );
    }

    const cacheKey = createCacheKey(
      "kpi_conversation_summary",
      dealershipId,
      req.query.period || "last30days",
    );
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      "conversation_summary",
      dealershipTag(dealershipId),
    ];

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching conversation summary KPI", {
          dealershipId,
        });
        // Mocked data - replace with actual queries
        const totalConversations = await executeQuery(() =>
          db.execute(
            `SELECT COUNT(*) as count FROM conversations WHERE dealership_id = $1`,
            [dealershipId],
          ),
        );
        const avgFirstResponseTime = Math.random() * 1000; // ms
        const resolutionRate = Math.random(); // 0-1
        const csatScore = Math.random() * 5; // 0-5

        return {
          totalConversations: totalConversations[0]?.count || 0,
          avgFirstResponseTime,
          resolutionRate,
          csatScore,
          lastUpdated: new Date().toISOString(),
        };
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags },
    );

    ResponseHelper.success(res, data, "Conversation summary KPI retrieved.");
  }),
);

// --- Lead Management KPIs ---

router.get(
  "/leads/conversion_rate",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
      );
    }

    const cacheKey = createCacheKey(
      "kpi_lead_conversion_rate",
      dealershipId,
      req.query.period || "last30days",
    );
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      "lead_conversion",
      dealershipTag(dealershipId),
    ];

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching lead conversion rate KPI", {
          dealershipId,
        });
        // Mocked data - replace with actual queries assuming 'leads' table with 'status'
        const totalLeads = await executeQuery(() =>
          db.execute(
            `SELECT COUNT(*) as count FROM leads WHERE dealership_id = $1 AND status = 'new'`,
            [dealershipId], // Example status
          ),
        );
        const convertedLeads = await executeQuery(() =>
          db.execute(
            `SELECT COUNT(*) as count FROM leads WHERE dealership_id = $1 AND status = 'converted'`,
            [dealershipId], // Example status
          ),
        );

        const rate =
          totalLeads[0]?.count > 0
            ? (convertedLeads[0]?.count || 0) / totalLeads[0]?.count
            : 0;
        return {
          totalLeads: totalLeads[0]?.count || 0,
          convertedLeads: convertedLeads[0]?.count || 0,
          conversionRate: rate,
          lastUpdated: new Date().toISOString(),
        };
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags },
    );

    ResponseHelper.success(res, data, "Lead conversion rate KPI retrieved.");
  }),
);

router.get(
  "/leads/funnel",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
      );
    }

    const cacheKey = createCacheKey(
      "kpi_lead_funnel",
      dealershipId,
      req.query.period || "last30days",
    );
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      "lead_funnel",
      dealershipTag(dealershipId),
    ];

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching lead funnel KPI", { dealershipId });
        // Mocked data - replace with actual queries
        return {
          newLeads: Math.floor(Math.random() * 1000),
          qualifiedLeads: Math.floor(Math.random() * 500),
          opportunities: Math.floor(Math.random() * 200),
          closedWon: Math.floor(Math.random() * 100),
          lastUpdated: new Date().toISOString(),
        };
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags },
    );

    ResponseHelper.success(res, data, "Lead funnel KPI retrieved.");
  }),
);

// --- System Performance KPIs ---

router.get(
  "/system/performance",
  asyncHandler(async (req: Request, res: Response) => {
    const cacheKey = createCacheKey("kpi_system_performance");
    // System KPIs are generally not dealership specific, but could be tagged if needed
    const tags = [KPI_CACHE_TAG_PREFIX, "system_performance"];

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching system performance KPI");
        const monitoringMetrics = monitoring.getMetrics(); // Assuming this returns relevant data
        const healthStatus = await monitoring.getOverallHealthStatus();

        return {
          uptimeSeconds: monitoringMetrics.uptimeSeconds,
          overallHealth: healthStatus.status,
          errorRate:
            (monitoringMetrics.totalErrors /
              (monitoringMetrics.totalRequests || 1)) *
            100, // Example error rate
          avgApiLatencyMs: parseFloat(
            Object.values(monitoringMetrics.requestsPerRoute)
              .map((r: any) => r.avgResponseTimeMs || 0)
              .reduce((sum: number, val: number) => sum + val, 0) /
              (
                Object.keys(monitoringMetrics.requestsPerRoute).length || 1
              ).toFixed(2),
          ),
          lastUpdated: new Date().toISOString(),
        };
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags }, // System KPIs might have slightly longer TTL
    );

    ResponseHelper.success(res, data, "System performance KPI retrieved.");
  }),
);

// --- Inventory Analytics KPIs ---

router.get(
  "/inventory/turnover",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    if (isNaN(dealershipId)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required and must be a number.",
      );
    }

    const cacheKey = createCacheKey(
      "kpi_inventory_turnover",
      dealershipId,
      req.query.period || "last30days",
    );
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      "inventory_turnover",
      dealershipTag(dealershipId),
    ];

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching inventory turnover KPI", {
          dealershipId,
        });
        // Mocked data - replace with actual queries
        return {
          turnoverRate: Math.random() * 10, // Example
          avgDaysOnLot: Math.random() * 90, // Example
          lastUpdated: new Date().toISOString(),
        };
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags },
    );

    ResponseHelper.success(res, data, "Inventory turnover KPI retrieved.");
  }),
);

// --- Cache Management Endpoints ---

router.post(
  "/cache/invalidate/tag/:tag",
  asyncHandler(async (req: Request, res: Response) => {
    const { tag } = req.params;
    const dealershipId = req.query.dealershipId as string;

    let fullTag = tag;
    if (dealershipId) {
      fullTag = `${tag}_${dealershipTag(dealershipId)}`; // More specific invalidation
    } else {
      fullTag = `${KPI_CACHE_TAG_PREFIX}_${tag}`; // Broader invalidation
    }

    await cacheService.invalidateTag(fullTag);
    logger.info(`KPI cache invalidated by tag: ${fullTag}`);
    ResponseHelper.success(
      res,
      { invalidatedTag: fullTag },
      "KPI cache invalidated by tag.",
    );
  }),
);

router.post(
  "/cache/invalidate/pattern/:pattern",
  asyncHandler(async (req: Request, res: Response) => {
    const { pattern } = req.params;
    const dealershipId = req.query.dealershipId as string;

    let fullPattern = pattern;
    if (dealershipId) {
      fullPattern = `${KPI_CACHE_TAG_PREFIX}_${pattern}_${dealershipTag(dealershipId)}`;
    } else {
      fullPattern = `${KPI_CACHE_TAG_PREFIX}_${pattern}`;
    }

    await cacheService.invalidatePattern(fullPattern);
    logger.info(`KPI cache invalidated by pattern: ${fullPattern}`);
    ResponseHelper.success(
      res,
      { invalidatedPattern: fullPattern },
      "KPI cache invalidated by pattern.",
    );
  }),
);

router.post(
  "/cache/warm/:kpiName",
  asyncHandler(async (req: Request, res: Response) => {
    const { kpiName } = req.params;
    const dealershipId = Number(req.query.dealershipId); // Optional

    // This is a simplified warming strategy. A real one might involve calling the actual KPI functions.
    // Here, we'll just register a key for warming if it's a known KPI.
    let cacheKeyToWarm: string | null = null;

    switch (kpiName) {
      case "conversation_summary":
        cacheKeyToWarm = createCacheKey(
          "kpi_conversation_summary",
          dealershipId || "all",
          req.query.period || "last30days",
        );
        break;
      case "lead_conversion_rate":
        cacheKeyToWarm = createCacheKey(
          "kpi_lead_conversion_rate",
          dealershipId || "all",
          req.query.period || "last30days",
        );
        break;
      // Add other KPIs
      default:
        throw new AppError(
          ErrorCode.NOT_FOUND,
          `KPI ${kpiName} not found for warming.`,
        );
    }

    if (cacheKeyToWarm) {
      cacheService.registerForWarming(cacheKeyToWarm);
      // Optionally, trigger an immediate refresh for this specific key
      // This would require knowing the factory function for the KPI.
      // For now, just registering for the background warmer.
      logger.info(
        `KPI ${kpiName} (key: ${cacheKeyToWarm}) registered for cache warming.`,
      );
      ResponseHelper.success(
        res,
        { warmedKey: cacheKeyToWarm },
        `KPI ${kpiName} registered for warming.`,
      );
    } else {
      ResponseHelper.error(
        res,
        new AppError(
          ErrorCode.INTERNAL_SERVER_ERROR,
          "Failed to identify cache key for warming.",
        ),
      );
    }
  }),
);

router.get(
  "/cache/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await cacheService.getInfo(); // Get detailed stats including Redis info
    // Filter for KPI-specific stats if needed, or provide all.
    // For now, returning all stats.
    ResponseHelper.success(res, stats, "KPI cache statistics retrieved.");
  }),
);

// --- Real-time vs. Cached Comparison ---

router.get(
  "/:kpiGroup/:kpiName/compare",
  asyncHandler(async (req: Request, res: Response) => {
    const { kpiGroup, kpiName } = req.params;
    const dealershipId = Number(req.query.dealershipId); // Assuming all KPIs can be dealership-specific
    const period = (req.query.period as string) || "last30days";

    if (isNaN(dealershipId) && kpiGroup !== "system") {
      // System KPIs might not need dealershipId
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "dealershipId is required for this KPI comparison.",
      );
    }

    const cacheKey = createCacheKey(
      `kpi_${kpiGroup}_${kpiName}`,
      dealershipId,
      period,
    );
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      `${kpiGroup}_${kpiName}`,
      dealershipTag(dealershipId),
    ];

    // Define a generic factory resolver - this is highly simplified
    const resolveKpiFactory = async (): Promise<any> => {
      logger.info(`Factory call for KPI: ${kpiGroup}/${kpiName}`, {
        dealershipId,
        period,
      });
      // In a real app, this would dynamically call the correct KPI generation logic
      // For this example, let's mock a generic response
      if (kpiGroup === "conversations" && kpiName === "summary") {
        const totalConversations = await executeQuery(() =>
          db.execute(
            `SELECT COUNT(*) as count FROM conversations WHERE dealership_id = $1`,
            [dealershipId],
          ),
        );
        return {
          totalConversations: totalConversations[0]?.count || 0,
          avgFirstResponseTime: Math.random() * 1000,
          resolutionRate: Math.random(),
          csatScore: Math.random() * 5,
          source: "live_data",
          timestamp: new Date().toISOString(),
        };
      }
      return {
        message: `Live data for ${kpiGroup}/${kpiName}`,
        timestamp: new Date().toISOString(),
        source: "live_data",
      };
    };

    // Fetch cached data
    const cachedData = await cacheService.getOrSet(
      cacheKey,
      resolveKpiFactory,
      { ttl: KPI_CACHE_TTL, kpi: true, tags },
    );

    // Fetch live data (force refresh)
    const liveData = await cacheService.getOrSet(cacheKey, resolveKpiFactory, {
      ttl: KPI_CACHE_TTL,
      kpi: true,
      tags,
      forceRefresh: true,
    });

    ResponseHelper.success(
      res,
      { cached: cachedData, live: liveData },
      "KPI comparison data retrieved.",
    );
  }),
);

// --- KPI Dashboard Aggregation Endpoints ---

router.get(
  "/dashboard/overview",
  asyncHandler(async (req: Request, res: Response) => {
    const dealershipId = Number(req.query.dealershipId);
    if (isNaN(dealershipId)) {
      throw new AppError(ErrorCode.INVALID_INPUT, "dealershipId is required.");
    }
    const period = (req.query.period as string) || "last30days";

    const cacheKey = createCacheKey(
      "kpi_dashboard_overview",
      dealershipId,
      period,
    );
    // Aggregate tags from multiple KPI sources
    const tags = [
      KPI_CACHE_TAG_PREFIX,
      "dashboard_overview",
      dealershipTag(dealershipId),
      "conversation_summary", // Depends on conversation summary
      "lead_conversion", // Depends on lead conversion
    ];

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info("Cache miss - fetching KPI dashboard overview", {
          dealershipId,
          period,
        });

        // This would involve calling multiple KPI generation functions or a complex query
        // For example, fetching conversation summary and lead conversion rate
        const conversationSummaryFactory = async () => {
          const totalConversations = await executeQuery(() =>
            db.execute(
              `SELECT COUNT(*) as count FROM conversations WHERE dealership_id = $1`,
              [dealershipId],
            ),
          );
          return {
            totalConversations: totalConversations[0]?.count || 0,
            avgFirstResponseTime: Math.random() * 1000,
          };
        };
        const leadConversionFactory = async () => {
          const totalLeads = await executeQuery(() =>
            db.execute(
              `SELECT COUNT(*) as count FROM leads WHERE dealership_id = $1 AND status = 'new'`,
              [dealershipId],
            ),
          );
          const convertedLeads = await executeQuery(() =>
            db.execute(
              `SELECT COUNT(*) as count FROM leads WHERE dealership_id = $1 AND status = 'converted'`,
              [dealershipId],
            ),
          );
          return {
            conversionRate:
              totalLeads[0]?.count > 0
                ? (convertedLeads[0]?.count || 0) / totalLeads[0]?.count
                : 0,
          };
        };

        // Fetch dependent KPIs (these will also use their own caching)
        const [convSummary, leadConv] = await Promise.all([
          cacheService.getOrSet(
            createCacheKey("kpi_conversation_summary", dealershipId, period),
            conversationSummaryFactory,
            {
              ttl: KPI_CACHE_TTL,
              kpi: true,
              tags: [
                KPI_CACHE_TAG_PREFIX,
                "conversation_summary",
                dealershipTag(dealershipId),
              ],
            },
          ),
          cacheService.getOrSet(
            createCacheKey("kpi_lead_conversion_rate", dealershipId, period),
            leadConversionFactory,
            {
              ttl: KPI_CACHE_TTL,
              kpi: true,
              tags: [
                KPI_CACHE_TAG_PREFIX,
                "lead_conversion",
                dealershipTag(dealershipId),
              ],
            },
          ),
        ]);

        return {
          dealershipId,
          period,
          conversationMetrics: convSummary,
          leadMetrics: leadConv,
          // Add more aggregated KPIs here
          overallPerformanceScore: Math.random() * 100, // Example
          lastUpdated: new Date().toISOString(),
        };
      },
      { ttl: KPI_CACHE_TTL, kpi: true, tags, background: true }, // Enable background refresh for critical dashboards
    );

    ResponseHelper.success(res, data, "KPI dashboard overview retrieved.");
  }),
);

// --- ETL Event Triggered Invalidation (Example - actual invalidation is handled by CacheService listener) ---
// This endpoint is more for manual/testing triggers if needed, or specific programmatic invalidation.
router.post(
  "/etl/event",
  asyncHandler(async (req: Request, res: Response) => {
    const { source, event, entityId, dealershipId } = req.body;

    if (!source || !event) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        "ETL source and event are required.",
      );
    }

    logger.info("Received ETL event notification for KPI invalidation", {
      source,
      event,
      entityId,
      dealershipId,
    });

    // The cacheService.handleEtlEvent method is the primary way to handle these.
    // This endpoint could be used to trigger it programmatically if not using pub/sub,
    // or to perform additional logic.
    await cacheService.handleEtlEvent(source, event);

    // Example: If a specific lead was updated, invalidate caches related to that lead
    if (source === "final_watchdog" && event === "lead_updated" && entityId) {
      const leadCachePattern = `lead_detail_${entityId}`; // Assuming a pattern for lead detail caches
      await cacheService.invalidatePattern(leadCachePattern);
      logger.info(`Invalidated lead-specific cache for lead ID: ${entityId}`);
    }

    ResponseHelper.success(res, {
      message: "ETL event processed for cache invalidation.",
    });
  }),
);

export default router;
