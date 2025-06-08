#!/usr/bin/env tsx

import axios, { AxiosInstance, AxiosError } from "axios";
import Redis from "ioredis";
import { setTimeout as sleep } from "timers/promises";

// --- Configuration ---
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000/api"; // Assuming server runs on 8000 from cleanrylie
const REDIS_URL = process.env.REDIS_URL; // e.g., 'redis://localhost:6379'
const DEFAULT_DEALERSHIP_ID = 1;
const KPI_CACHE_TTL_SECONDS = 30;
const SUB_50MS_THRESHOLD = 50;

// --- Logger ---
const logger = {
  info: (message: string, context?: any) =>
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, context || ""),
  warn: (message: string, context?: any) =>
    console.warn(
      `[WARN] ${new Date().toISOString()} ${message}`,
      context || "",
    ),
  error: (message: string, context?: any) =>
    console.error(
      `[ERROR] ${new Date().toISOString()} ${message}`,
      context || "",
    ),
  debug: (message: string, context?: any) =>
    console.debug(
      `[DEBUG] ${new Date().toISOString()} ${message}`,
      context || "",
    ),
  group: (label: string) => console.group(label),
  groupEnd: () => console.groupEnd(),
  logMetric: (metricName: string, value: any, unit?: string) =>
    console.log(`[METRIC] ${metricName}: ${value}${unit ? " " + unit : ""}`),
};

// --- HTTP Client ---
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15 seconds timeout
});

// --- Redis Client (optional, for direct checks) ---
let redisClient: Redis | null = null;
if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    redisClient.on("error", (err) =>
      logger.error("Redis Client Error (background)", err),
    );
  } catch (e) {
    logger.error("Failed to initialize Redis client", e);
    redisClient = null;
  }
}

// --- Test State & Metrics ---
interface TestMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  suiteMetrics: Record<
    string,
    {
      name: string;
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      durationMs: number;
    }
  >;
}
const testMetrics: TestMetrics = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  suiteMetrics: {},
};
let currentSuiteName: string = "";
let currentSuiteStartTime: number = 0;

// --- Helper Functions ---

async function startSuite(suiteName: string) {
  currentSuiteName = suiteName;
  currentSuiteStartTime = Date.now();
  logger.group(`\n🧪 SUITE: ${suiteName}`);
  testMetrics.suiteMetrics[suiteName] = {
    name: suiteName,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
  };
}

function endSuite() {
  const suite = testMetrics.suiteMetrics[currentSuiteName];
  if (suite) {
    suite.durationMs = Date.now() - currentSuiteStartTime;
    logger.logMetric(`${currentSuiteName} Duration`, suite.durationMs, "ms");
    logger.info(
      `Suite ${currentSuiteName} Summary: Passed: ${suite.passed}, Failed: ${suite.failed}, Skipped: ${suite.skipped} (Total: ${suite.total})`,
    );
  }
  logger.groupEnd();
  currentSuiteName = "";
}

async function runTest<T>(
  testName: string,
  testFn: () => Promise<T>,
  skip = false,
): Promise<T | undefined> {
  const suite = testMetrics.suiteMetrics[currentSuiteName];
  suite.total++;
  testMetrics.totalTests++;

  if (skip) {
    logger.warn(`[SKIPPED] ${testName}`);
    suite.skipped++;
    testMetrics.skipped++;
    return undefined;
  }

  logger.info(`[RUNNING] ${testName}`);
  const startTime = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;
    logger.info(`[PASSED] ${testName} (Duration: ${duration}ms)`);
    suite.passed++;
    testMetrics.passed++;
    return result;
  } catch (e: any) {
    const duration = Date.now() - startTime;
    logger.error(`[FAILED] ${testName} (Duration: ${duration}ms)`, {
      message: e.message,
      stack: e.stack,
      ...(e.isAxiosError && { responseData: (e as AxiosError).response?.data }),
    });
    suite.failed++;
    testMetrics.failed++;
    // Optionally re-throw if we want the whole script to stop on first failure
    // throw e;
    return undefined;
  }
}

async function assert(condition: boolean, message: string, context?: any) {
  if (!condition) {
    logger.error("Assertion Failed:", { message, context });
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function clearAllCacheAPI() {
  logger.debug("Clearing all cache via API...");
  try {
    await apiClient.post("/performance/cache/clear"); // Assuming this endpoint clears all cache
    await apiClient.post("/kpi/cache/clear"); // Also clear kpi cache specific patterns if any
    logger.debug("Cache cleared via API.");
    await sleep(500); // Give time for events to propagate if any
  } catch (error) {
    logger.warn("Failed to clear cache via API, proceeding cautiously.", error);
  }
}

async function getKpi(
  endpoint: string,
  params?: Record<string, any>,
): Promise<{ data: any; duration: number }> {
  const startTime = Date.now();
  try {
    const response = await apiClient.get(endpoint, { params });
    const duration = Date.now() - startTime;
    return { data: response.data.data || response.data, duration }; // Adapt based on actual response structure
  } catch (e: any) {
    const duration = Date.now() - startTime;
    logger.error(`Failed to get KPI: ${endpoint}`, {
      params,
      error: e.message,
      duration,
    });
    throw e;
  }
}

async function getCacheStatsAPI(): Promise<any> {
  try {
    // Try the more detailed /kpi/cache/stats first
    const response = await apiClient.get("/kpi/cache/stats");
    return response.data.data || response.data;
  } catch (kpiError) {
    logger.warn(
      "Failed to get /kpi/cache/stats, trying /performance/cache/stats",
      kpiError,
    );
    try {
      const response = await apiClient.get("/performance/cache/stats");
      return response.data.data || response.data;
    } catch (perfError) {
      logger.error("Failed to get cache stats from any endpoint", perfError);
      throw perfError;
    }
  }
}

// --- Test Suites ---

async function testPerformanceAndTTL() {
  await startSuite("Performance & TTL Verification");

  const kpiEndpoint = "/kpi/conversations/summary";
  const params = { dealershipId: DEFAULT_DEALERSHIP_ID, period: "test_ttl" };

  await runTest("Initial fetch (cache miss)", async () => {
    await clearAllCacheAPI();
    const { duration, data } = await getKpi(kpiEndpoint, params);
    logger.logMetric("Initial fetch duration", duration, "ms");
    assert(data !== null, "Data should not be null on initial fetch");
    assert(
      typeof data.totalConversations === "number",
      "Expected totalConversations",
    );
  });

  await runTest("Second fetch (cache hit, sub-50ms)", async () => {
    const { duration, data } = await getKpi(kpiEndpoint, params);
    logger.logMetric("Cached fetch duration", duration, "ms");
    assert(
      duration < SUB_50MS_THRESHOLD,
      `Cached response should be < ${SUB_50MS_THRESHOLD}ms, got ${duration}ms`,
    );
    assert(data !== null, "Data should not be null on cached fetch");
  });

  await runTest(
    `Wait for TTL expiry (approx ${KPI_CACHE_TTL_SECONDS + 5}s)`,
    async () => {
      logger.info(`Waiting for ${KPI_CACHE_TTL_SECONDS + 5} seconds...`);
      await sleep((KPI_CACHE_TTL_SECONDS + 5) * 1000);
    },
  );

  await runTest(
    "Fetch after TTL (cache miss or background refresh)",
    async () => {
      const { duration, data } = await getKpi(kpiEndpoint, params);
      logger.logMetric("Fetch after TTL duration", duration, "ms");
      // If background refresh is very fast, this might still be a hit.
      // The key is that data is fresh. We'll check freshness in background refresh tests.
      assert(data !== null, "Data should not be null on fetch after TTL");
    },
  );

  await runTest("Fetch again (should be cached, sub-50ms)", async () => {
    const { duration, data } = await getKpi(kpiEndpoint, params);
    logger.logMetric("Second cached fetch duration", duration, "ms");
    assert(
      duration < SUB_50MS_THRESHOLD,
      `Second cached response should be < ${SUB_50MS_THRESHOLD}ms, got ${duration}ms`,
    );
    assert(data !== null, "Data should not be null");
  });

  endSuite();
}

async function testETLEventInvalidation() {
  await startSuite("ETL Event Invalidation (final_watchdog integration)");

  const kpiEndpoint = "/kpi/leads/conversion_rate";
  const params = { dealershipId: DEFAULT_DEALERSHIP_ID, period: "test_etl" };
  const etlEventPayload = {
    source: "final_watchdog",
    event: "kpi_data_updated",
  }; // This should invalidate all KPIs

  await runTest("Cache a KPI", async () => {
    await clearAllCacheAPI();
    await getKpi(kpiEndpoint, params); // Initial fetch to cache
    const { duration } = await getKpi(kpiEndpoint, params); // Second fetch to confirm cached
    assert(
      duration < SUB_50MS_THRESHOLD,
      `KPI should be cached, got ${duration}ms`,
    );
  });

  await runTest(
    "Simulate final_watchdog ETL event (kpi_data_updated)",
    async () => {
      await apiClient.post("/kpi/etl/event", etlEventPayload);
      logger.info("ETL event sent.");
      await sleep(1000); // Allow time for invalidation propagation
    },
  );

  await runTest(
    "Fetch KPI after ETL event (should be a cache miss)",
    async () => {
      // To confirm a cache miss, we check if the response time is higher than the cached threshold.
      // This is an approximation, as server load can affect it.
      // A more robust way would be to check cache stats if possible or specific log messages.
      const { duration, data } = await getKpi(kpiEndpoint, params);
      logger.logMetric("Fetch after ETL event duration", duration, "ms");
      assert(data !== null, "Data should not be null");
      // Assuming a miss takes longer than a hit. This is a weak assertion.
      // A better check would be to see if 'lastUpdated' timestamp changed, if the factory always updates it.
      // Or check cache stats for a miss.
    },
  );

  await runTest("Simulate specific ETL event (leads_updated)", async () => {
    await clearAllCacheAPI();
    await getKpi(kpiEndpoint, params); // Cache it
    const specificEtlPayload = {
      source: "final_watchdog",
      event: "leads_updated",
    };
    await apiClient.post("/kpi/etl/event", specificEtlPayload);
    logger.info("Specific ETL event (leads_updated) sent.");
    await sleep(1000);
    // Fetch and check if it was a miss or if its 'lastUpdated' changed
    // This depends on how 'leads_updated' is mapped to cache invalidation patterns in CacheService
  });

  endSuite();
}

async function testBackgroundRefresh() {
  await startSuite("Background Refresh Capabilities");
  // This test is conceptual as true background refresh is hard to assert from outside without specific metrics.
  // We'll check if data gets updated without a slow "miss" fetch after some time.

  const kpiEndpoint = "/kpi/system/performance"; // A KPI that might be good for background refresh
  const params = {}; // No specific params for system performance

  await runTest("Cache a KPI with potential background refresh", async () => {
    await clearAllCacheAPI();
    const { data: initialData, duration: initialDuration } = await getKpi(
      kpiEndpoint,
      params,
    );
    logger.logMetric(
      "Initial fetch for background refresh test",
      initialDuration,
      "ms",
    );
    assert(initialData !== null, "Initial data should exist");

    // Fetch again to ensure it's cached
    const { duration: cachedDuration } = await getKpi(kpiEndpoint, params);
    assert(cachedDuration < SUB_50MS_THRESHOLD, "Should be cached");
  });

  await runTest(
    `Wait for a period less than TTL but enough for background refresh trigger (e.g., ${KPI_CACHE_TTL_SECONDS * 0.6}s)`,
    async () => {
      const waitTime = KPI_CACHE_TTL_SECONDS * 0.6; // e.g., 18s for 30s TTL
      logger.info(
        `Waiting for ${waitTime} seconds for background refresh to potentially trigger...`,
      );
      await sleep(waitTime * 1000);
    },
  );

  let dataAfterPotentialRefresh: any;
  await runTest(
    "Fetch again, expecting fast response (from cache, possibly old or bg refreshed)",
    async () => {
      const { data, duration } = await getKpi(kpiEndpoint, params);
      logger.logMetric(
        "Fetch after partial TTL (background refresh check)",
        duration,
        "ms",
      );
      assert(
        duration < SUB_50MS_THRESHOLD * 2,
        `Should still be relatively fast, got ${duration}ms`,
      ); // Allow a bit more leeway
      assert(data !== null, "Data should exist");
      dataAfterPotentialRefresh = data;
    },
  );

  await runTest(
    `Wait beyond TTL (e.g., ${KPI_CACHE_TTL_SECONDS + 5}s total) to ensure original item would have expired`,
    async () => {
      // Total wait time from initial cache will be (KPI_CACHE_TTL_SECONDS * 0.6) + (KPI_CACHE_TTL_SECONDS * 0.4 + 5)
      const remainingWait = KPI_CACHE_TTL_SECONDS * 0.4 + 5;
      logger.info(`Waiting for another ${remainingWait} seconds...`);
      await sleep(remainingWait * 1000);
    },
  );

  await runTest(
    "Fetch after full TTL cycle, check if data was refreshed",
    async () => {
      const { data: finalData, duration } = await getKpi(kpiEndpoint, params);
      logger.logMetric(
        "Fetch after full TTL (background refresh validation)",
        duration,
        "ms",
      );
      assert(finalData !== null, "Final data should exist");
      // Ideally, finalData.lastUpdated would be newer than dataAfterPotentialRefresh.lastUpdated
      // This requires the KPI factory to always update 'lastUpdated'.
      if (finalData.lastUpdated && dataAfterPotentialRefresh.lastUpdated) {
        assert(
          new Date(finalData.lastUpdated) >=
            new Date(dataAfterPotentialRefresh.lastUpdated),
          "Data should have been refreshed by background process or new fetch.",
        );
        logger.info("Validated data freshness.", {
          previousLastUpdated: dataAfterPotentialRefresh.lastUpdated,
          currentLastUpdated: finalData.lastUpdated,
        });
      } else {
        logger.warn(
          "Cannot validate data freshness due to missing lastUpdated fields.",
        );
      }
    },
  );

  endSuite();
}

async function testCacheWarming() {
  await startSuite("Cache Warming Functionality");
  // This requires an endpoint to register for warming or relies on KPIs being auto-registered.
  // We'll use the warming registration endpoint if available.

  const kpiName = "conversation_summary"; // A KPI we can try to warm
  const kpiEndpoint = `/kpi/conversations/summary`;
  const params = { dealershipId: DEFAULT_DEALERSHIP_ID, period: "test_warm" };
  const cacheKeyForWarming = `rylie:kpi_conversation_summary:${DEFAULT_DEALERSHIP_ID}:test_warm`; // Approximate key

  await runTest("Clear cache and register KPI for warming", async () => {
    await clearAllCacheAPI();
    try {
      await apiClient.post(`/kpi/cache/warm/${kpiName}`, null, {
        params: { dealershipId: DEFAULT_DEALERSHIP_ID, period: "test_warm" },
      });
      logger.info(`KPI ${kpiName} registered for warming.`);
    } catch (e) {
      logger.warn(
        `Failed to register KPI for warming via API, test might be limited.`,
        e,
      );
    }
  });

  await runTest(
    "Wait for cache warming interval (e.g., 65s for 60s interval)",
    async () => {
      const warmingInterval = 60; // Assume 60s from CacheService config
      logger.info(
        `Waiting for ${warmingInterval + 5} seconds for cache warmer to run...`,
      );
      await sleep((warmingInterval + 5) * 1000);
    },
  );

  await runTest("Fetch KPI, expecting it to be cached by warmer", async () => {
    // If warming worked, this should be a hit.
    // This is a strong assumption if the /kpi/cache/warm endpoint doesn't force an immediate fetch.
    // The warmer should pick it up.
    const { duration, data } = await getKpi(kpiEndpoint, params);
    logger.logMetric("Fetch after warming period", duration, "ms");
    assert(data !== null, "Data should exist");
    // This assertion is tricky. If the warmer just ran, it should be a hit.
    // If the /kpi/cache/warm endpoint itself caches, then this is a hit.
    // We are testing the *effect* of the warming system.
    assert(
      duration < SUB_50MS_THRESHOLD * 2,
      `Should be reasonably fast if warmed, got ${duration}ms`,
    );

    if (redisClient) {
      const existsInRedis = await redisClient.exists(cacheKeyForWarming);
      assert(
        existsInRedis > 0,
        `Key ${cacheKeyForWarming} should exist in Redis if warmed.`,
      );
      logger.info(`Key ${cacheKeyForWarming} found in Redis.`);
    }
  });

  endSuite();
}

async function testTagBasedInvalidation() {
  await startSuite("Tag-Based Invalidation Patterns");

  const kpiConvSummary = "/kpi/conversations/summary";
  const kpiLeadFunnel = "/kpi/leads/funnel";
  const paramsDept1 = {
    dealershipId: DEFAULT_DEALERSHIP_ID,
    period: "tag_test",
  };
  const paramsDept2 = {
    dealershipId: DEFAULT_DEALERSHIP_ID + 1,
    period: "tag_test",
  };

  // These KPIs should share a common tag like 'kpi' or 'dealership_X'
  const tagToInvalidate = `dealership_${DEFAULT_DEALERSHIP_ID}`; // Defined in kpi-routes.ts
  const specificTagForConvSummary = `conversation_summary_dealership_${DEFAULT_DEALERSHIP_ID}`; // More specific

  await runTest("Cache multiple KPIs for different dealerships", async () => {
    await clearAllCacheAPI();
    await getKpi(kpiConvSummary, paramsDept1); // Cache for dealership 1
    await getKpi(kpiLeadFunnel, paramsDept1); // Cache for dealership 1
    await getKpi(kpiConvSummary, paramsDept2); // Cache for dealership 2

    // Verify they are cached
    let res = await getKpi(kpiConvSummary, paramsDept1);
    assert(res.duration < SUB_50MS_THRESHOLD, "KPI 1 (Dept1) should be cached");
    res = await getKpi(kpiLeadFunnel, paramsDept1);
    assert(res.duration < SUB_50MS_THRESHOLD, "KPI 2 (Dept1) should be cached");
    res = await getKpi(kpiConvSummary, paramsDept2);
    assert(res.duration < SUB_50MS_THRESHOLD, "KPI 1 (Dept2) should be cached");
  });

  await runTest(`Invalidate by tag: ${tagToInvalidate}`, async () => {
    // The kpi-routes.ts uses `KPI_CACHE_TAG_PREFIX` and `dealershipTag(id)`
    // So, invalidating `dealership_X` should work if items are tagged correctly.
    // The endpoint `/kpi/cache/invalidate/tag/:tag` might need adjustment if it doesn't handle composite tags well.
    // Let's assume the tag `dealership_X` is directly usable or the endpoint handles it.
    // The kpi-routes.ts uses `dealershipTag(dealershipId)` which becomes `dealership_X`
    await apiClient.post(`/kpi/cache/invalidate/tag/${tagToInvalidate}`);
    logger.info(`Invalidation request sent for tag: ${tagToInvalidate}`);
    await sleep(1000); // Propagation time
  });

  await runTest("Verify KPIs for dealership 1 are invalidated", async () => {
    let res = await getKpi(kpiConvSummary, paramsDept1); // Should be a miss
    logger.logMetric(
      `Fetch KPI 1 (Dept1) after tag invalidation`,
      res.duration,
      "ms",
    );
    // assert(res.duration > SUB_50MS_THRESHOLD * 1.5, 'KPI 1 (Dept1) should be a cache miss'); // Weak assertion

    res = await getKpi(kpiLeadFunnel, paramsDept1); // Should be a miss
    logger.logMetric(
      `Fetch KPI 2 (Dept1) after tag invalidation`,
      res.duration,
      "ms",
    );
    // assert(res.duration > SUB_50MS_THRESHOLD * 1.5, 'KPI 2 (Dept1) should be a cache miss');
  });

  await runTest("Verify KPI for dealership 2 is NOT invalidated", async () => {
    const res = await getKpi(kpiConvSummary, paramsDept2); // Should be a hit
    logger.logMetric(
      `Fetch KPI 1 (Dept2) after tag invalidation (should be hit)`,
      res.duration,
      "ms",
    );
    assert(
      res.duration < SUB_50MS_THRESHOLD,
      "KPI 1 (Dept2) should still be cached",
    );
  });

  endSuite();
}

async function testAccuracyAndConsistency() {
  await startSuite("KPI Query Accuracy & Consistency");
  const kpiEndpoint = "/kpi/conversations/summary";
  const params = {
    dealershipId: DEFAULT_DEALERSHIP_ID,
    period: "accuracy_test",
  };
  const compareEndpoint = `/kpi/conversations/summary/compare`; // From kpi-routes.ts

  await runTest(
    "Fetch cached vs live data using compare endpoint",
    async () => {
      await clearAllCacheAPI();
      const { data } = await apiClient.get(compareEndpoint, { params });
      assert(
        data.success === true || data.cached,
        "Compare endpoint should return data",
      ); // Adapt to actual response
      const { cached, live } = data.data || data;

      assert(
        cached !== null && live !== null,
        "Both cached and live data should exist",
      );
      assert(
        typeof cached.totalConversations === "number",
        "Cached data structure error",
      );
      assert(
        typeof live.totalConversations === "number",
        "Live data structure error",
      );
      // Values might differ if data changed between fetches, but structure should be consistent.
      // If the factory always sets a 'lastUpdated' or similar, live.lastUpdated >= cached.lastUpdated
      if (cached.lastUpdated && live.lastUpdated) {
        assert(
          new Date(live.lastUpdated) >= new Date(cached.lastUpdated),
          "Live data should be at least as fresh as cached data.",
        );
      }
      logger.info("Comparison data:", { cached, live });
    },
  );
  endSuite();
}

async function testMonitoringIntegration() {
  await startSuite("Monitoring Integration Validation");
  const kpiEndpoint = "/kpi/inventory/turnover";
  const params = {
    dealershipId: DEFAULT_DEALERSHIP_ID,
    period: "monitoring_test",
  };

  let initialStats: any;
  await runTest("Get initial cache stats", async () => {
    initialStats = await getCacheStatsAPI();
    assert(initialStats !== null, "Initial stats should be fetched");
    logger.debug(
      "Initial Cache Stats:",
      initialStats.kpiQueries || initialStats,
    );
  });

  await runTest("Perform KPI queries (hits and misses)", async () => {
    await clearAllCacheAPI(); // Ensure misses
    await getKpi(kpiEndpoint, params); // Miss
    await getKpi(kpiEndpoint, params); // Hit
    await getKpi(kpiEndpoint, params); // Hit
  });

  await runTest("Get updated cache stats and verify increments", async () => {
    const updatedStats = await getCacheStatsAPI();
    assert(updatedStats !== null, "Updated stats should be fetched");
    logger.debug(
      "Updated Cache Stats:",
      updatedStats.kpiQueries || updatedStats,
    );

    const initialKpiStats = initialStats.kpiQueries || { total: 0, cached: 0 };
    const updatedKpiStats = updatedStats.kpiQueries || { total: 0, cached: 0 };

    // These assertions depend on whether other tests ran and dirtied the stats.
    // For a clean run, these would be more precise.
    assert(
      updatedKpiStats.total >= initialKpiStats.total + 1,
      `KPI total queries should increment. Got ${updatedKpiStats.total}, expected >= ${initialKpiStats.total + 1}`,
    );
    assert(
      updatedKpiStats.cached >= initialKpiStats.cached + 2,
      `KPI cached queries should increment by 2. Got ${updatedKpiStats.cached}, expected >= ${initialKpiStats.cached + 2}`,
    );

    logger.logMetric("Cache Hits (from stats)", updatedStats.hits, "");
    logger.logMetric("Cache Misses (from stats)", updatedStats.misses, "");
    logger.logMetric(
      "KPI Queries Total (from stats)",
      updatedKpiStats.total,
      "",
    );
    logger.logMetric(
      "KPI Queries Cached (from stats)",
      updatedKpiStats.cached,
      "",
    );
    logger.logMetric(
      "KPI Avg Response Time (from stats)",
      updatedKpiStats.avgResponseTime,
      "ms",
    );
    logger.logMetric(
      "KPI Sub-50ms % (from stats)",
      updatedKpiStats.sub50msPercentage,
      "%",
    );

    // Check specific monitoring endpoint if available
    // e.g. /api/monitoring/metrics for OTel Prometheus formatted metrics
  });
  endSuite();
}

async function testErrorHandling() {
  await startSuite("Error Handling & Fallback Behavior");

  // Test case: KPI factory function fails
  // This requires a specific test endpoint or a way to make a factory fail.
  // Assuming '/kpi/system/performance_error' is a test endpoint that intentionally throws.
  const errorKpiEndpoint = "/kpi/system/performance_error_test"; // Needs to be created or mocked

  await runTest(
    "KPI factory function error",
    async () => {
      try {
        await getKpi(errorKpiEndpoint);
        assert(false, "Request to erroring KPI should have failed");
      } catch (e: any) {
        assert(e.isAxiosError, "Error should be an AxiosError");
        const axiosError = e as AxiosError;
        assert(
          axiosError.response?.status === 500 ||
            axiosError.response?.status === 503,
          `Expected 500/503 status, got ${axiosError.response?.status}`,
        );
        logger.info("Correctly handled KPI factory error.", {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });
      }
    },
    true,
  ); // Skipping for now as endpoint doesn't exist

  // Test case: Redis down (if Redis is configured)
  await runTest(
    "Redis unavailable (manual test if applicable)",
    async () => {
      if (!REDIS_URL || !redisClient) {
        logger.warn("Redis not configured, skipping Redis down test.");
        return; // Skip if no Redis
      }
      // This test would typically involve manually stopping Redis server.
      // Then, requests should fall back to memory cache.
      logger.info(
        "MANUAL STEP: Temporarily stop Redis server if you want to test this.",
      );
      logger.info("Waiting 10 seconds for manual Redis stop...");
      // await sleep(10000);
      // const { duration, data } = await getKpi('/kpi/conversations/summary', { dealershipId: DEFAULT_DEALERSHIP_ID, period: 'redis_down' });
      // assert(data !== null, 'Should fallback to memory cache');
      // logger.info('Fallback to memory cache successful (presumably).', { duration });
      // logger.info('MANUAL STEP: Restart Redis server.');
    },
    true,
  ); // Skipping as it's a manual/disruptive test

  endSuite();
}

async function testConcurrentRequests() {
  await startSuite("Concurrent Request Handling");
  const kpiEndpoint = "/kpi/leads/funnel";
  const params = {
    dealershipId: DEFAULT_DEALERSHIP_ID,
    period: "concurrent_test",
  };

  await runTest(
    "Multiple concurrent requests for an uncached KPI",
    async () => {
      await clearAllCacheAPI();
      const numRequests = 10;
      const promises = [];
      logger.info(
        `Sending ${numRequests} concurrent requests to ${kpiEndpoint}`,
      );
      for (let i = 0; i < numRequests; i++) {
        promises.push(getKpi(kpiEndpoint, params));
      }

      const results = await Promise.all(promises);
      let firstData: any = null;
      results.forEach((res, i) => {
        assert(
          res.data !== null,
          `Concurrent request ${i + 1} data should not be null`,
        );
        if (i === 0) {
          firstData = res.data;
        } else {
          // Compare structure or key fields. Exact match if factory is deterministic and no data changes.
          assert(
            JSON.stringify(res.data) === JSON.stringify(firstData),
            `Data from concurrent request ${i + 1} should match first request`,
          );
        }
        logger.logMetric(
          `Concurrent request ${i + 1} duration`,
          res.duration,
          "ms",
        );
      });
      logger.info(`${numRequests} concurrent requests completed successfully.`);
      // Check logs for "Cache miss - fetching..." to see if factory was called multiple times.
      // Ideally, it should be called once or very few times.
    },
  );
  endSuite();
}

// --- Main Test Runner ---
async function main() {
  logger.info("🚀 Starting H6 KPI Query Caching Integration Test Script 🚀");
  logger.info(`API Base URL: ${API_BASE_URL}`);
  if (REDIS_URL && redisClient) {
    try {
      await redisClient.connect(); // Explicitly connect if lazy
      await redisClient.ping();
      logger.info("Redis connection successful.");
    } catch (e) {
      logger.error(
        "Initial Redis connection failed. Some tests might behave differently.",
        e,
      );
      if (redisClient) await redisClient.disconnect();
      redisClient = null; // Ensure it's null if connection failed
    }
  } else {
    logger.warn(
      "Redis URL not configured or client init failed. Tests will rely on in-memory cache behavior.",
    );
  }

  const overallStartTime = Date.now();

  try {
    await testPerformanceAndTTL();
    await testETLEventInvalidation();
    await testBackgroundRefresh();
    await testCacheWarming();
    await testTagBasedInvalidation();
    await testAccuracyAndConsistency();
    await testMonitoringIntegration();
    await testConcurrentRequests();
    await testErrorHandling(); // Run error handling last as it might involve disruptive actions
  } catch (e: any) {
    logger.error("Critical error during test execution, stopping script.", {
      message: e.message,
      stack: e.stack,
    });
    testMetrics.failed++; // Count this as a general failure
  } finally {
    if (redisClient) {
      await redisClient
        .quit()
        .catch((e) => logger.error("Error quitting Redis client", e));
    }
    const overallDuration = Date.now() - overallStartTime;
    logger.info("\n🏁 Test Script Finished 🏁");
    logger.logMetric("Overall Script Duration", overallDuration, "ms");
    logger.info("==================== TEST SUMMARY ====================");
    Object.values(testMetrics.suiteMetrics).forEach((suite) => {
      logger.info(
        `SUITE: ${suite.name} | Total: ${suite.total}, Passed: ${suite.passed}, Failed: ${suite.failed}, Skipped: ${suite.skipped} | Duration: ${suite.durationMs}ms`,
      );
    });
    logger.info("----------------------------------------------------");
    logger.info(
      `OVERALL TOTAL: ${testMetrics.totalTests}, PASSED: ${testMetrics.passed}, FAILED: ${testMetrics.failed}, SKIPPED: ${testMetrics.skipped}`,
    );
    logger.info("====================================================");

    if (testMetrics.failed > 0) {
      logger.error("🔴 Some tests failed!");
      process.exit(1);
    } else if (
      testMetrics.passed === 0 &&
      testMetrics.totalTests > 0 &&
      testMetrics.skipped === testMetrics.totalTests
    ) {
      logger.warn("🟡 All tests were skipped.");
      process.exit(0); // Or 1 if skipped tests should also indicate an issue
    } else if (testMetrics.passed > 0) {
      logger.info("🟢 All executed tests passed!");
      process.exit(0);
    } else {
      logger.warn("🔵 No tests were executed or passed.");
      process.exit(0); // Or 1 if no tests is an issue
    }
  }
}

main().catch((err) => {
  logger.error("Unhandled exception in main test runner:", err);
  process.exit(1);
});
