/**
 * Watchdog KPI Adapter Service
 *
 * This service provides an interface to the Watchdog API for retrieving KPI metrics
 * specifically focused on Google Ads performance data. It handles data transformation,
 * caching, aggregation, and error handling for KPI metrics like ROAS, CPA, and CTR.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import { logger } from "../utils/logger";
import { db } from "../db";
import { dailySpendLogs } from "../../shared/schema";
import {
  and,
  avg,
  between,
  desc,
  eq,
  gte,
  lte,
  max,
  min,
  sql,
  sum,
} from "drizzle-orm";
import NodeCache from "node-cache";
import { promClient } from "../observability/metrics";
import { retry } from "../utils/retry";
import { createTracer } from "../observability/tracing";

// Metrics for monitoring
const kpiRequestCounter = new promClient.Counter({
  name: "watchdog_kpi_requests_total",
  help: "Total number of KPI requests made to Watchdog API",
  labelNames: ["metric", "status"],
});

const kpiRequestDuration = new promClient.Histogram({
  name: "watchdog_kpi_request_duration_seconds",
  help: "Duration of KPI requests to Watchdog API",
  labelNames: ["metric"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const kpiCacheHits = new promClient.Counter({
  name: "watchdog_kpi_cache_hits_total",
  help: "Total number of KPI cache hits",
  labelNames: ["metric"],
});

// Configure OpenTelemetry tracing
const tracer = createTracer("watchdog-kpi-adapter");

// KPI data interfaces
export interface AdsKpiMetrics {
  cid: string;
  date?: Date;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  roas: number;
  cpa: number;
  currencyCode: string;
}

export interface AdsKpiTimeSeriesData {
  dates: string[];
  metrics: {
    impressions: number[];
    clicks: number[];
    cost: number[];
    conversions: number[];
    conversionValue: number[];
    ctr: number[];
    cpc: number[];
    roas: number[];
    cpa: number[];
  };
}

export interface AdsKpiResponse {
  success: boolean;
  data?: AdsKpiMetrics | AdsKpiMetrics[];
  timeSeries?: AdsKpiTimeSeriesData;
  error?: string;
  metadata?: {
    timeRange: string;
    lastUpdated: Date;
    source: string;
    aggregation?: string;
    filters?: Record<string, any>;
  };
}

export interface KpiFilter {
  startDate?: Date | string;
  endDate?: Date | string;
  campaignId?: string;
  campaignIds?: string[];
  cid?: string;
  groupBy?: "day" | "week" | "month" | "campaign" | "account";
  limit?: number;
  includeTimeSeries?: boolean;
}

/**
 * WatchdogKpiAdapter - Service for retrieving and processing KPI data from Watchdog
 */
export class WatchdogKpiAdapter {
  private client: AxiosInstance;
  private cache: NodeCache;
  private baseUrl: string;
  private readonly DEFAULT_CACHE_TTL = 300; // 5 minutes
  private readonly LONG_CACHE_TTL = 3600; // 1 hour for historical data

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl =
      baseUrl || process.env.WATCHDOG_API_URL || "http://localhost:8000";
    this.cache = new NodeCache({
      stdTTL: this.DEFAULT_CACHE_TTL,
      checkperiod: 120,
    });

    const config: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (apiKey || process.env.WATCHDOG_API_KEY) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${apiKey || process.env.WATCHDOG_API_KEY}`,
      };
    }

    this.client = axios.create(config);

    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logger.debug(`Watchdog KPI API request to ${config.url}`);
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `Watchdog KPI API response from ${response.config.url} - Status: ${response.status}`,
        );
        return response;
      },
      (error: AxiosError) => {
        logger.error(`Watchdog KPI API error: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Make an API request with retry logic
   */
  private async request<T>(
    method: "get" | "post",
    endpoint: string,
    data?: any,
    params?: any,
  ): Promise<T> {
    const metricName = endpoint.split("/").pop() || "unknown";
    const timer = kpiRequestDuration.startTimer({ metric: metricName });

    try {
      const response = await retry(
        async () => {
          if (method === "get") {
            return await this.client.get(endpoint, { params });
          } else {
            return await this.client.post(endpoint, data, { params });
          }
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn(
              `Retry attempt ${attempt} for ${endpoint} due to: ${error.message}`,
            );
          },
        },
      );

      kpiRequestCounter.inc({ metric: metricName, status: "success" });
      return response.data as T;
    } catch (error: any) {
      kpiRequestCounter.inc({ metric: metricName, status: "error" });
      logger.error(
        `Watchdog KPI API error in ${method.toUpperCase()} ${endpoint}`,
        { error: error.message },
      );

      if (error.response) {
        throw new Error(
          `Watchdog KPI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      } else if (error.request) {
        throw new Error(`Watchdog KPI API no response: ${error.message}`);
      } else {
        throw new Error(`Watchdog KPI request failed: ${error.message}`);
      }
    } finally {
      timer();
    }
  }

  /**
   * Get cached data or execute the function to retrieve fresh data
   */
  private async getCachedData<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.DEFAULT_CACHE_TTL,
  ): Promise<T> {
    const cachedData = this.cache.get<T>(cacheKey);

    if (cachedData) {
      kpiCacheHits.inc({ metric: cacheKey.split(":")[0] });
      return cachedData;
    }

    const data = await fetchFn();
    this.cache.set(cacheKey, data, ttl);
    return data;
  }

  /**
   * Check Watchdog API health
   */
  async checkHealth(): Promise<{ status: string; version?: string }> {
    try {
      const response = await this.client.get("/health");
      return response.data;
    } catch (error) {
      logger.error("Watchdog KPI health check failed", { error });
      return { status: "error" };
    }
  }

  /**
   * Get Google Ads KPI metrics from Watchdog API
   */
  async getAdsKpi(
    cid: string,
    filter: KpiFilter = {},
  ): Promise<AdsKpiResponse> {
    const span = tracer.startSpan("getAdsKpi");
    span.setAttribute("cid", cid);

    try {
      const cacheKey = `adsKpi:${cid}:${JSON.stringify(filter)}`;

      // Determine if this is historical or recent data for cache TTL
      const isHistorical =
        filter.endDate &&
        new Date(filter.endDate).getTime() < Date.now() - 86400000;
      const cacheTtl = isHistorical
        ? this.LONG_CACHE_TTL
        : this.DEFAULT_CACHE_TTL;

      return await this.getCachedData(
        cacheKey,
        async () => {
          // First try to get from local database
          const dbData = await this.getKpiFromDatabase(cid, filter);

          if (dbData.success && dbData.data) {
            return {
              ...dbData,
              metadata: {
                ...dbData.metadata,
                source: "database",
              },
            };
          }

          // If not in database or incomplete, fetch from Watchdog API
          const apiResponse = await this.request<any>(
            "get",
            `/api/kpi/ads/${cid}`,
            null,
            {
              start_date: filter.startDate,
              end_date: filter.endDate,
              campaign_id: filter.campaignId,
              campaign_ids: filter.campaignIds?.join(","),
              group_by: filter.groupBy,
              limit: filter.limit,
              include_time_series: filter.includeTimeSeries,
            },
          );

          return this.transformApiResponse(apiResponse, filter);
        },
        cacheTtl,
      );
    } catch (error: any) {
      logger.error(`Error getting Ads KPI for ${cid}`, {
        error: error.message,
        filter,
      });
      span.setStatus({ code: 2, message: error.message }); // SpanStatusCode.ERROR = 2

      return {
        success: false,
        error: error.message,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "error",
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get ROAS (Return on Ad Spend) metrics
   */
  async getRoas(cid: string, filter: KpiFilter = {}): Promise<AdsKpiResponse> {
    const span = tracer.startSpan("getRoas");
    span.setAttribute("cid", cid);

    try {
      const response = await this.getAdsKpi(cid, filter);

      // If it's an array, calculate average ROAS
      if (response.success && Array.isArray(response.data)) {
        const totalCost = response.data.reduce(
          (sum, item) => sum + item.cost,
          0,
        );
        const totalValue = response.data.reduce(
          (sum, item) => sum + item.conversionValue,
          0,
        );

        const avgRoas = totalCost > 0 ? totalValue / totalCost : 0;

        return {
          success: true,
          data: {
            cid,
            roas: avgRoas,
            cost: totalCost,
            conversionValue: totalValue,
            impressions: response.data.reduce(
              (sum, item) => sum + item.impressions,
              0,
            ),
            clicks: response.data.reduce((sum, item) => sum + item.clicks, 0),
            conversions: response.data.reduce(
              (sum, item) => sum + item.conversions,
              0,
            ),
            ctr:
              response.data.reduce((sum, item) => sum + item.ctr, 0) /
              response.data.length,
            cpc:
              response.data.reduce((sum, item) => sum + item.cpc, 0) /
              response.data.length,
            cpa:
              response.data.reduce((sum, item) => sum + item.cpa, 0) /
              response.data.length,
            currencyCode: response.data[0]?.currencyCode || "USD",
          },
          metadata: {
            ...response.metadata,
            aggregation: "average",
          },
        };
      }

      return response;
    } catch (error: any) {
      logger.error(`Error getting ROAS for ${cid}`, {
        error: error.message,
        filter,
      });
      span.setStatus({ code: 2, message: error.message });

      return {
        success: false,
        error: error.message,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "error",
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get CPA (Cost Per Acquisition) metrics
   */
  async getCpa(cid: string, filter: KpiFilter = {}): Promise<AdsKpiResponse> {
    const span = tracer.startSpan("getCpa");
    span.setAttribute("cid", cid);

    try {
      const response = await this.getAdsKpi(cid, filter);

      // If it's an array, calculate average CPA
      if (response.success && Array.isArray(response.data)) {
        const totalCost = response.data.reduce(
          (sum, item) => sum + item.cost,
          0,
        );
        const totalConversions = response.data.reduce(
          (sum, item) => sum + item.conversions,
          0,
        );

        const avgCpa = totalConversions > 0 ? totalCost / totalConversions : 0;

        return {
          success: true,
          data: {
            cid,
            cpa: avgCpa,
            cost: totalCost,
            conversions: totalConversions,
            impressions: response.data.reduce(
              (sum, item) => sum + item.impressions,
              0,
            ),
            clicks: response.data.reduce((sum, item) => sum + item.clicks, 0),
            conversionValue: response.data.reduce(
              (sum, item) => sum + item.conversionValue,
              0,
            ),
            ctr:
              response.data.reduce((sum, item) => sum + item.ctr, 0) /
              response.data.length,
            cpc:
              response.data.reduce((sum, item) => sum + item.cpc, 0) /
              response.data.length,
            roas:
              response.data.reduce((sum, item) => sum + item.roas, 0) /
              response.data.length,
            currencyCode: response.data[0]?.currencyCode || "USD",
          },
          metadata: {
            ...response.metadata,
            aggregation: "average",
          },
        };
      }

      return response;
    } catch (error: any) {
      logger.error(`Error getting CPA for ${cid}`, {
        error: error.message,
        filter,
      });
      span.setStatus({ code: 2, message: error.message });

      return {
        success: false,
        error: error.message,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "error",
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get CTR (Click-Through Rate) metrics
   */
  async getCtr(cid: string, filter: KpiFilter = {}): Promise<AdsKpiResponse> {
    const span = tracer.startSpan("getCtr");
    span.setAttribute("cid", cid);

    try {
      const response = await this.getAdsKpi(cid, filter);

      // If it's an array, calculate average CTR
      if (response.success && Array.isArray(response.data)) {
        const totalImpressions = response.data.reduce(
          (sum, item) => sum + item.impressions,
          0,
        );
        const totalClicks = response.data.reduce(
          (sum, item) => sum + item.clicks,
          0,
        );

        const avgCtr =
          totalImpressions > 0 ? totalClicks / totalImpressions : 0;

        return {
          success: true,
          data: {
            cid,
            ctr: avgCtr,
            impressions: totalImpressions,
            clicks: totalClicks,
            cost: response.data.reduce((sum, item) => sum + item.cost, 0),
            conversions: response.data.reduce(
              (sum, item) => sum + item.conversions,
              0,
            ),
            conversionValue: response.data.reduce(
              (sum, item) => sum + item.conversionValue,
              0,
            ),
            cpc:
              response.data.reduce((sum, item) => sum + item.cpc, 0) /
              response.data.length,
            roas:
              response.data.reduce((sum, item) => sum + item.roas, 0) /
              response.data.length,
            cpa:
              response.data.reduce((sum, item) => sum + item.cpa, 0) /
              response.data.length,
            currencyCode: response.data[0]?.currencyCode || "USD",
          },
          metadata: {
            ...response.metadata,
            aggregation: "average",
          },
        };
      }

      return response;
    } catch (error: any) {
      logger.error(`Error getting CTR for ${cid}`, {
        error: error.message,
        filter,
      });
      span.setStatus({ code: 2, message: error.message });

      return {
        success: false,
        error: error.message,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "error",
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get KPI data for a specific time period (7d, 30d, etc.)
   */
  async getKpiForTimePeriod(
    cid: string,
    period: "7d" | "30d" | "90d" | "ytd" | "all",
    metric?: "roas" | "cpa" | "ctr",
  ): Promise<AdsKpiResponse> {
    const span = tracer.startSpan("getKpiForTimePeriod");
    span.setAttribute("cid", cid);
    span.setAttribute("period", period);

    try {
      let startDate: Date | undefined;
      const endDate = new Date();

      // Calculate start date based on period
      switch (period) {
        case "7d":
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90d":
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 90);
          break;
        case "ytd":
          startDate = new Date(endDate.getFullYear(), 0, 1); // Jan 1 of current year
          break;
        case "all":
          startDate = undefined; // No start date means all available data
          break;
      }

      const filter: KpiFilter = {
        startDate: startDate
          ? startDate.toISOString().split("T")[0]
          : undefined,
        endDate: endDate.toISOString().split("T")[0],
        includeTimeSeries: true,
      };

      // Call the appropriate metric method if specified
      if (metric) {
        switch (metric) {
          case "roas":
            return await this.getRoas(cid, filter);
          case "cpa":
            return await this.getCpa(cid, filter);
          case "ctr":
            return await this.getCtr(cid, filter);
        }
      }

      // Default to all metrics
      return await this.getAdsKpi(cid, filter);
    } catch (error: any) {
      logger.error(`Error getting KPI for period ${period}`, {
        error: error.message,
        cid,
      });
      span.setStatus({ code: 2, message: error.message });

      return {
        success: false,
        error: error.message,
        metadata: {
          timeRange: period,
          lastUpdated: new Date(),
          source: "error",
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get KPI data from the database
   */
  private async getKpiFromDatabase(
    cid: string,
    filter: KpiFilter = {},
  ): Promise<AdsKpiResponse> {
    const span = tracer.startSpan("getKpiFromDatabase");
    span.setAttribute("cid", cid);

    try {
      let query = db
        .select({
          cid: dailySpendLogs.cid,
          impressions: sum(dailySpendLogs.impressions),
          clicks: sum(dailySpendLogs.clicks),
          costMicros: sum(dailySpendLogs.costMicros),
          conversions: sum(dailySpendLogs.conversions),
          conversionValueMicros: sum(dailySpendLogs.conversionValueMicros),
          ctr: avg(dailySpendLogs.ctr),
          cpcMicros: avg(dailySpendLogs.cpcMicros),
          roas: avg(dailySpendLogs.roas),
          cpaMicros: avg(dailySpendLogs.cpaMicros),
          currencyCode: dailySpendLogs.accountCurrencyCode,
        })
        .from(dailySpendLogs)
        .where(eq(dailySpendLogs.cid, cid));

      // Apply filters
      if (filter.startDate && filter.endDate) {
        query = query.where(
          between(
            dailySpendLogs.date,
            new Date(filter.startDate),
            new Date(filter.endDate),
          ),
        );
      } else if (filter.startDate) {
        query = query.where(
          gte(dailySpendLogs.date, new Date(filter.startDate)),
        );
      } else if (filter.endDate) {
        query = query.where(lte(dailySpendLogs.date, new Date(filter.endDate)));
      }

      if (filter.campaignId) {
        query = query.where(eq(dailySpendLogs.campaignId, filter.campaignId));
      }

      if (filter.campaignIds && filter.campaignIds.length > 0) {
        // Use SQL IN operator for campaign IDs
        const campaignIdsCondition = sql`${dailySpendLogs.campaignId} IN (${filter.campaignIds.join(",")})`;
        query = query.where(campaignIdsCondition);
      }

      // Group by based on filter
      if (filter.groupBy === "campaign") {
        query = query.groupBy(
          dailySpendLogs.campaignId,
          dailySpendLogs.campaignName,
          dailySpendLogs.cid,
          dailySpendLogs.accountCurrencyCode,
        );
      } else if (filter.groupBy === "day") {
        query = query.groupBy(
          dailySpendLogs.date,
          dailySpendLogs.cid,
          dailySpendLogs.accountCurrencyCode,
        );
      } else if (filter.groupBy === "account") {
        query = query.groupBy(
          dailySpendLogs.cid,
          dailySpendLogs.accountCurrencyCode,
        );
      }

      // Apply limit if specified
      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      const results = await query;

      if (!results || results.length === 0) {
        return {
          success: false,
          error: "No data found in database",
          metadata: {
            timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
            lastUpdated: new Date(),
            source: "database",
          },
        };
      }

      // Transform results to AdsKpiMetrics format
      const transformedResults = results.map((result) => ({
        cid: result.cid,
        impressions: Number(result.impressions) || 0,
        clicks: Number(result.clicks) || 0,
        cost: Number(result.costMicros) / 1000000 || 0,
        conversions: Number(result.conversions) || 0,
        conversionValue: Number(result.conversionValueMicros) / 1000000 || 0,
        ctr: Number(result.ctr) || 0,
        cpc: Number(result.cpcMicros) / 1000000 || 0,
        roas: Number(result.roas) || 0,
        cpa: Number(result.cpaMicros) / 1000000 || 0,
        currencyCode: result.currencyCode || "USD",
      }));

      // If time series data is requested, fetch it separately
      let timeSeriesData: AdsKpiTimeSeriesData | undefined;

      if (filter.includeTimeSeries && filter.startDate && filter.endDate) {
        timeSeriesData = await this.getTimeSeriesFromDatabase(cid, filter);
      }

      return {
        success: true,
        data:
          transformedResults.length === 1
            ? transformedResults[0]
            : transformedResults,
        timeSeries: timeSeriesData,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "database",
          filters: filter,
        },
      };
    } catch (error: any) {
      logger.error(`Error getting KPI from database for ${cid}`, {
        error: error.message,
        filter,
      });
      span.setStatus({ code: 2, message: error.message });

      return {
        success: false,
        error: `Database error: ${error.message}`,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "database_error",
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get time series data from the database
   */
  private async getTimeSeriesFromDatabase(
    cid: string,
    filter: KpiFilter,
  ): Promise<AdsKpiTimeSeriesData | undefined> {
    if (!filter.startDate || !filter.endDate) {
      return undefined;
    }

    try {
      const query = db
        .select({
          date: dailySpendLogs.date,
          impressions: sum(dailySpendLogs.impressions),
          clicks: sum(dailySpendLogs.clicks),
          costMicros: sum(dailySpendLogs.costMicros),
          conversions: sum(dailySpendLogs.conversions),
          conversionValueMicros: sum(dailySpendLogs.conversionValueMicros),
          ctr: avg(dailySpendLogs.ctr),
          cpcMicros: avg(dailySpendLogs.cpcMicros),
          roas: avg(dailySpendLogs.roas),
          cpaMicros: avg(dailySpendLogs.cpaMicros),
        })
        .from(dailySpendLogs)
        .where(
          and(
            eq(dailySpendLogs.cid, cid),
            between(
              dailySpendLogs.date,
              new Date(filter.startDate),
              new Date(filter.endDate),
            ),
          ),
        )
        .groupBy(dailySpendLogs.date)
        .orderBy(dailySpendLogs.date);

      if (filter.campaignId) {
        query.where(eq(dailySpendLogs.campaignId, filter.campaignId));
      }

      const results = await query;

      if (!results || results.length === 0) {
        return undefined;
      }

      // Transform to time series format
      const dates = results.map(
        (r) => r.date?.toISOString().split("T")[0] || "",
      );

      const timeSeries: AdsKpiTimeSeriesData = {
        dates,
        metrics: {
          impressions: results.map((r) => Number(r.impressions) || 0),
          clicks: results.map((r) => Number(r.clicks) || 0),
          cost: results.map((r) => Number(r.costMicros) / 1000000 || 0),
          conversions: results.map((r) => Number(r.conversions) || 0),
          conversionValue: results.map(
            (r) => Number(r.conversionValueMicros) / 1000000 || 0,
          ),
          ctr: results.map((r) => Number(r.ctr) || 0),
          cpc: results.map((r) => Number(r.cpcMicros) / 1000000 || 0),
          roas: results.map((r) => Number(r.roas) || 0),
          cpa: results.map((r) => Number(r.cpaMicros) / 1000000 || 0),
        },
      };

      return timeSeries;
    } catch (error: any) {
      logger.error(`Error getting time series data for ${cid}`, {
        error: error.message,
      });
      return undefined;
    }
  }

  /**
   * Transform API response to our internal format
   */
  private transformApiResponse(
    apiResponse: any,
    filter: KpiFilter,
  ): AdsKpiResponse {
    if (!apiResponse || !apiResponse.success) {
      return {
        success: false,
        error: apiResponse?.error || "Invalid API response",
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "api_error",
        },
      };
    }

    try {
      // Transform single metric
      if (apiResponse.data && !Array.isArray(apiResponse.data)) {
        const transformedData: AdsKpiMetrics = {
          cid: apiResponse.data.cid || apiResponse.data.account_id,
          impressions: apiResponse.data.impressions || 0,
          clicks: apiResponse.data.clicks || 0,
          cost: apiResponse.data.cost || 0,
          conversions: apiResponse.data.conversions || 0,
          conversionValue: apiResponse.data.conversion_value || 0,
          ctr: apiResponse.data.ctr || 0,
          cpc: apiResponse.data.cpc || 0,
          roas: apiResponse.data.roas || 0,
          cpa: apiResponse.data.cpa || 0,
          currencyCode: apiResponse.data.currency_code || "USD",
        };

        return {
          success: true,
          data: transformedData,
          metadata: {
            timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
            lastUpdated: new Date(apiResponse.last_updated || Date.now()),
            source: "api",
          },
        };
      }

      // Transform array of metrics
      if (Array.isArray(apiResponse.data)) {
        const transformedData: AdsKpiMetrics[] = apiResponse.data.map(
          (item: any) => ({
            cid: item.cid || item.account_id,
            date: item.date ? new Date(item.date) : undefined,
            impressions: item.impressions || 0,
            clicks: item.clicks || 0,
            cost: item.cost || 0,
            conversions: item.conversions || 0,
            conversionValue: item.conversion_value || 0,
            ctr: item.ctr || 0,
            cpc: item.cpc || 0,
            roas: item.roas || 0,
            cpa: item.cpa || 0,
            currencyCode: item.currency_code || "USD",
          }),
        );

        // Transform time series if available
        let timeSeriesData: AdsKpiTimeSeriesData | undefined;

        if (apiResponse.time_series) {
          timeSeriesData = {
            dates: apiResponse.time_series.dates || [],
            metrics: {
              impressions: apiResponse.time_series.metrics?.impressions || [],
              clicks: apiResponse.time_series.metrics?.clicks || [],
              cost: apiResponse.time_series.metrics?.cost || [],
              conversions: apiResponse.time_series.metrics?.conversions || [],
              conversionValue:
                apiResponse.time_series.metrics?.conversion_value || [],
              ctr: apiResponse.time_series.metrics?.ctr || [],
              cpc: apiResponse.time_series.metrics?.cpc || [],
              roas: apiResponse.time_series.metrics?.roas || [],
              cpa: apiResponse.time_series.metrics?.cpa || [],
            },
          };
        }

        return {
          success: true,
          data: transformedData,
          timeSeries: timeSeriesData,
          metadata: {
            timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
            lastUpdated: new Date(apiResponse.last_updated || Date.now()),
            source: "api",
            filters: filter,
          },
        };
      }

      // Handle unexpected response format
      return {
        success: false,
        error: "Unexpected API response format",
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "api_format_error",
        },
      };
    } catch (error: any) {
      logger.error("Error transforming API response", { error: error.message });

      return {
        success: false,
        error: `Transformation error: ${error.message}`,
        metadata: {
          timeRange: `${filter.startDate || "all"} to ${filter.endDate || "now"}`,
          lastUpdated: new Date(),
          source: "transform_error",
        },
      };
    }
  }

  /**
   * Clear cache for a specific CID or all caches
   */
  clearCache(cid?: string): void {
    if (cid) {
      // Clear all caches for this CID
      const keys = this.cache.keys().filter((key) => key.includes(`${cid}:`));
      keys.forEach((key) => this.cache.del(key));
      logger.info(`Cleared ${keys.length} cache entries for CID ${cid}`);
    } else {
      // Clear all caches
      this.cache.flushAll();
      logger.info("Cleared all KPI caches");
    }
  }
}

// Export singleton instance
export const watchdogKpiAdapter = new WatchdogKpiAdapter();
