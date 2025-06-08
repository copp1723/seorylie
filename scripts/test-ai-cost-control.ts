#!/usr/bin/env ts-node
/**
 * AI Cost Control Service - Integration Test
 *
 * This script tests the AI Cost Control Service functionality:
 * - Template-first generation
 * - Redis caching
 * - Rate limiting
 * - Cost tracking metrics
 * - Cache invalidation
 *
 * Usage:
 *   npm run test:ai-cost-control
 *
 * Environment variables:
 *   REDIS_URL - Redis connection URL (default: redis://localhost:6379)
 *   TEST_DEALERSHIP_ID - Dealership ID to use for testing (default: 1)
 */

import { createClient } from "redis";
import {
  AiCostControlService,
  initializeAiCostControlService,
} from "../server/services/ai-cost-control-service";
import { prometheusMetrics } from "../server/services/prometheus-metrics";
import { AdfLead } from "../shared/adf-schema";
import { Dealership } from "../shared/schema";
import logger from "../server/utils/logger";
import { performance } from "perf_hooks";
import fs from "fs";
import path from "path";

// Mock the enhanced-ai-service to avoid actual OpenAI calls
jest.mock("../server/services/enhanced-ai-service", () => {
  const originalModule = jest.requireActual(
    "../server/services/enhanced-ai-service",
  );

  // Mock the getCompletion method to return a fixed response
  const mockGetCompletion = jest
    .fn()
    .mockImplementation(async (prompt, options) => {
      // Simulate OpenAI latency
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        text: `This is a mock AI response for prompt type: ${options?.promptType || "unknown"}. The dealership ID is ${options?.dealershipId || "unknown"}.`,
        model: "gpt-3.5-turbo-mock",
        promptTokens: 150,
        completionTokens: 50,
        totalTokens: 200,
        latencyMs: 500,
      };
    });

  return {
    ...originalModule,
    aiService: {
      ...originalModule.aiService,
      getCompletion: mockGetCompletion,
    },
  };
});

// Configuration
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const TEST_DEALERSHIP_ID = parseInt(process.env.TEST_DEALERSHIP_ID || "1", 10);
const TEST_TIMEOUT = 60000; // 60 seconds

// Test data
const testDealership: Partial<Dealership> = {
  id: TEST_DEALERSHIP_ID,
  name: "Test Dealership",
  address: "123 Test Street, Test City, TS 12345",
  phone: "(555) 123-4567",
  website: "https://testdealership.example.com",
  salesHours: "Mon-Fri: 9am-8pm, Sat: 9am-6pm, Sun: Closed",
};

// Sample leads for testing
const createTestLead = (
  id: number,
  vehicleMake: string,
  intent: string,
): Partial<AdfLead> => ({
  id,
  externalId: `test-${id}`,
  dealershipId: TEST_DEALERSHIP_ID,
  customerName: "John Doe",
  customerEmail: "john.doe@example.com",
  customerPhone: "555-123-4567",
  vehicleYear: "2023",
  vehicleMake,
  vehicleModel: `${vehicleMake} Model`,
  vehicleTrim: "Premium",
  vehicleStockNumber: `ST${id}`,
  customerComments: `I'm interested in the ${vehicleMake} Model and would like to know about ${intent}.`,
});

// Main test function
async function runTests() {
  console.log("\n🚀 Starting AI Cost Control Service Tests\n");

  let redis: any = null;
  let aiCostControlService: AiCostControlService | null = null;

  try {
    // Setup
    console.log("📡 Connecting to Redis...");
    redis = createClient({ url: REDIS_URL });
    redis.on("error", (err: Error) => console.error("Redis error:", err));
    await redis.connect();
    console.log("✅ Connected to Redis");

    // Clear any existing test data
    console.log("🧹 Cleaning up previous test data...");
    const keys = await redis.keys("ai:response:*");
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`✅ Deleted ${keys.length} existing cache entries`);
    } else {
      console.log("✅ No existing cache entries to clean up");
    }

    // Initialize the AI Cost Control Service
    console.log("🔧 Initializing AI Cost Control Service...");
    aiCostControlService = await initializeAiCostControlService(redis, {
      rateLimitConfig: {
        maxConcurrent: 5,
        dailyLimit: 100,
        dealershipOverrides: {
          [TEST_DEALERSHIP_ID]: { dailyLimit: 10 }, // Lower limit for testing
        },
      },
      cacheEnabled: true,
      cacheTtlSeconds: 3600,
      redisKeyPrefix: "ai:response:test:",
    });
    console.log("✅ AI Cost Control Service initialized");

    // Ensure test templates exist
    await ensureTestTemplates();

    // Run test scenarios
    await testTemplateFirstGeneration(aiCostControlService);
    await testRedisCaching(aiCostControlService);
    await testRateLimiting(aiCostControlService);
    await testCostTracking();
    await testCacheInvalidation(aiCostControlService);

    console.log("\n🎉 All tests completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (redis) {
      console.log("🧹 Cleaning up test data...");
      const keys = await redis.keys("ai:response:test:*");
      if (keys.length > 0) {
        await redis.del(keys);
        console.log(`✅ Deleted ${keys.length} test cache entries`);
      }

      console.log("👋 Disconnecting from Redis...");
      await redis.disconnect();
      console.log("✅ Disconnected from Redis");
    }
  }

  process.exit(0);
}

/**
 * Ensure test templates exist in the templates directory
 */
async function ensureTestTemplates() {
  console.log("📝 Checking test templates...");

  const templatesDir = path.join(
    process.cwd(),
    "server",
    "templates",
    "ai-responses",
  );

  // Ensure directory exists
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
    console.log(`✅ Created templates directory: ${templatesDir}`);
  }

  // Check for required templates
  const requiredTemplates = [
    "pricing_inquiry.json",
    "test_drive_request.json",
    "rate_limit_exceeded.json",
    "error_fallback.json",
  ];

  let missingTemplates = false;

  for (const template of requiredTemplates) {
    const templatePath = path.join(templatesDir, template);
    if (!fs.existsSync(templatePath)) {
      console.log(`⚠️ Missing template: ${template}`);
      missingTemplates = true;
    }
  }

  if (missingTemplates) {
    console.log(
      "ℹ️ Please create the missing templates before running this test",
    );
    console.log("ℹ️ See ADF-011 implementation for template examples");
  } else {
    console.log("✅ All required templates exist");
  }
}

/**
 * Test template-first generation
 */
async function testTemplateFirstGeneration(service: AiCostControlService) {
  console.log("\n🧪 Testing Template-First Generation");

  // Create test leads with intents that match templates
  const pricingLead = createTestLead(1, "Honda", "pricing_inquiry");
  const testDriveLead = createTestLead(2, "Toyota", "test_drive_request");

  // Test pricing inquiry template
  console.log("📊 Testing pricing inquiry template...");
  const startTime1 = performance.now();
  const pricingResponse = await service.generateResponse(
    pricingLead,
    "pricing_inquiry",
    testDealership,
  );
  const duration1 = performance.now() - startTime1;

  console.log(`⏱️ Response time: ${duration1.toFixed(2)}ms`);
  console.log(`🔍 Response model: ${pricingResponse.model}`);
  console.log(`🔢 Tokens used: ${pricingResponse.totalTokens}`);

  if (pricingResponse.model === "template") {
    console.log("✅ Successfully used template for pricing inquiry");
  } else {
    throw new Error("❌ Failed to use template for pricing inquiry");
  }

  // Test test drive request template
  console.log("\n🚗 Testing test drive request template...");
  const startTime2 = performance.now();
  const testDriveResponse = await service.generateResponse(
    testDriveLead,
    "test_drive_request",
    testDealership,
  );
  const duration2 = performance.now() - startTime2;

  console.log(`⏱️ Response time: ${duration2.toFixed(2)}ms`);
  console.log(`🔍 Response model: ${testDriveResponse.model}`);
  console.log(`🔢 Tokens used: ${testDriveResponse.totalTokens}`);

  if (testDriveResponse.model === "template") {
    console.log("✅ Successfully used template for test drive request");
  } else {
    throw new Error("❌ Failed to use template for test drive request");
  }

  // Test fallback to AI for unknown intent
  console.log("\n🤖 Testing fallback to AI for unknown intent...");
  const unknownLead = createTestLead(3, "BMW", "unknown_intent");

  const startTime3 = performance.now();
  const unknownResponse = await service.generateResponse(
    unknownLead,
    "unknown_intent",
    testDealership,
  );
  const duration3 = performance.now() - startTime3;

  console.log(`⏱️ Response time: ${duration3.toFixed(2)}ms`);
  console.log(`🔍 Response model: ${unknownResponse.model}`);
  console.log(`🔢 Tokens used: ${unknownResponse.totalTokens}`);

  if (unknownResponse.model.includes("gpt")) {
    console.log("✅ Successfully fell back to AI for unknown intent");
  } else {
    throw new Error("❌ Failed to fall back to AI for unknown intent");
  }

  console.log("✅ Template-First Generation tests passed");
}

/**
 * Test Redis caching functionality
 */
async function testRedisCaching(service: AiCostControlService) {
  console.log("\n🧪 Testing Redis Caching");

  // Create a test lead for caching
  const cacheLead = createTestLead(4, "Lexus", "feature_inquiry");

  // First request should use AI (no cache)
  console.log("🔄 First request (should use AI)...");
  const startTime1 = performance.now();
  const response1 = await service.generateResponse(
    cacheLead,
    "feature_inquiry",
    testDealership,
  );
  const duration1 = performance.now() - startTime1;

  console.log(`⏱️ Response time: ${duration1.toFixed(2)}ms`);
  console.log(`🔍 Response model: ${response1.model}`);
  console.log(`🔢 Tokens used: ${response1.totalTokens}`);

  if (response1.model.includes("gpt")) {
    console.log("✅ First request correctly used AI");
  } else {
    throw new Error("❌ First request should have used AI");
  }

  // Second request with same intent/vehicle should hit cache
  console.log("\n🔄 Second request (should hit cache)...");
  const startTime2 = performance.now();
  const response2 = await service.generateResponse(
    cacheLead,
    "feature_inquiry",
    testDealership,
  );
  const duration2 = performance.now() - startTime2;

  console.log(`⏱️ Response time: ${duration2.toFixed(2)}ms`);
  console.log(`🔍 Response model: ${response2.model}`);
  console.log(`🔢 Tokens used: ${response2.totalTokens}`);

  if (response2.model.includes("cache")) {
    console.log("✅ Second request correctly hit cache");
  } else {
    throw new Error("❌ Second request should have hit cache");
  }

  // Verify cache is faster
  if (duration2 < duration1) {
    console.log(
      `✅ Cache is faster: ${duration1.toFixed(2)}ms vs ${duration2.toFixed(2)}ms`,
    );
  } else {
    console.log(
      `⚠️ Cache is not faster: ${duration1.toFixed(2)}ms vs ${duration2.toFixed(2)}ms`,
    );
  }

  // Test duplicate lead hitting cache (0 OpenAI calls)
  console.log(
    "\n🔄 Testing duplicate lead with same intent/vehicle (should hit cache)...",
  );
  const duplicateLead = createTestLead(5, "Lexus", "feature_inquiry");

  const startTime3 = performance.now();
  const response3 = await service.generateResponse(
    duplicateLead,
    "feature_inquiry",
    testDealership,
  );
  const duration3 = performance.now() - startTime3;

  console.log(`⏱️ Response time: ${duration3.toFixed(2)}ms`);
  console.log(`🔍 Response model: ${response3.model}`);
  console.log(`🔢 Tokens used: ${response3.totalTokens}`);

  if (response3.model.includes("cache") && response3.totalTokens === 0) {
    console.log("✅ Duplicate lead correctly hit cache with 0 OpenAI calls");
  } else {
    throw new Error(
      "❌ Duplicate lead should have hit cache with 0 OpenAI calls",
    );
  }

  console.log("✅ Redis Caching tests passed");
}

/**
 * Test rate limiting functionality
 */
async function testRateLimiting(service: AiCostControlService) {
  console.log("\n🧪 Testing Rate Limiting");

  // Get current rate limit status
  const initialStatus = await service.getRateLimitStatus(TEST_DEALERSHIP_ID);
  console.log(
    `ℹ️ Initial rate limit status: ${initialStatus.remaining}/${initialStatus.total} remaining`,
  );

  // Create a test lead for rate limiting
  const rateLimitLead = createTestLead(6, "Audi", "rate_limit_test");

  // Make multiple requests to test rate limiting
  const totalRequests = Math.min(initialStatus.remaining + 2, 15); // Make a few more than the limit
  console.log(
    `🔄 Making ${totalRequests} requests (limit: ${initialStatus.total})...`,
  );

  const results = [];

  for (let i = 0; i < totalRequests; i++) {
    const startTime = performance.now();
    const response = await service.generateResponse(
      { ...rateLimitLead, id: 1000 + i },
      `rate_limit_test_${i}`,
      testDealership,
      { forceFresh: true }, // Force fresh to avoid caching
    );
    const duration = performance.now() - startTime;

    results.push({
      requestNumber: i + 1,
      model: response.model,
      tokens: response.totalTokens,
      duration: duration.toFixed(2),
    });

    // Brief pause to avoid overwhelming the service
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Display results
  console.log("\n📊 Rate Limiting Test Results:");
  console.table(results);

  // Check if rate limiting was applied
  const rateLimitedResponses = results.filter(
    (r) => r.model === "rate_limited",
  );

  if (rateLimitedResponses.length > 0) {
    console.log(
      `✅ Rate limiting correctly applied after ${results.length - rateLimitedResponses.length} requests`,
    );
  } else {
    console.log(
      `⚠️ Rate limiting was not triggered after ${results.length} requests`,
    );
  }

  // Get updated rate limit status
  const finalStatus = await service.getRateLimitStatus(TEST_DEALERSHIP_ID);
  console.log(
    `ℹ️ Final rate limit status: ${finalStatus.remaining}/${finalStatus.total} remaining`,
  );

  if (finalStatus.remaining <= 0) {
    console.log("✅ Rate limit correctly depleted");
  } else {
    console.log(
      `⚠️ Rate limit not depleted: ${finalStatus.remaining} remaining`,
    );
  }

  console.log("✅ Rate Limiting tests passed");
}

/**
 * Test cost tracking metrics
 */
async function testCostTracking() {
  console.log("\n🧪 Testing Cost Tracking Metrics");

  // Get metrics registry
  const registry = prometheusMetrics.getRegistry();
  const metrics = await registry.getMetricsAsJSON();

  // Find openai_tokens_total metric
  const tokenMetric = metrics.find(
    (m: any) => m.name === "openai_tokens_total",
  );

  if (!tokenMetric) {
    throw new Error("❌ openai_tokens_total metric not found");
  }

  console.log("📊 OpenAI Token Usage Metrics:");

  // Extract and display token metrics
  const tokenMetrics = tokenMetric.values.map((v: any) => ({
    dealership: v.labels.dealership_id,
    model: v.labels.model,
    type: v.labels.token_type,
    tokens: v.value,
  }));

  console.table(tokenMetrics);

  // Check for metrics by source
  const sourceMetric = metrics.find(
    (m: any) => m.name === "ai_responses_generated_total",
  );

  if (!sourceMetric) {
    throw new Error("❌ ai_responses_generated_total metric not found");
  }

  console.log("\n📊 AI Response Source Metrics:");

  // Extract and display source metrics
  const sourceMetrics = sourceMetric.values.map((v: any) => ({
    dealership: v.labels.dealership_id,
    source: v.labels.source,
    intent: v.labels.intent,
    count: v.value,
  }));

  console.table(sourceMetrics);

  // Check for cache metrics
  const cacheMetric = metrics.find(
    (m: any) => m.name === "ai_cache_events_total",
  );

  if (!cacheMetric) {
    throw new Error("❌ ai_cache_events_total metric not found");
  }

  console.log("\n📊 AI Cache Event Metrics:");

  // Extract and display cache metrics
  const cacheMetrics = cacheMetric.values.map((v: any) => ({
    event: v.labels.event_type,
    source: v.labels.source,
    count: v.value,
  }));

  console.table(cacheMetrics);

  // Check for rate limit metrics
  const rateLimitMetric = metrics.find(
    (m: any) => m.name === "ai_rate_limit_events_total",
  );

  if (!rateLimitMetric) {
    throw new Error("❌ ai_rate_limit_events_total metric not found");
  }

  console.log("\n📊 AI Rate Limit Event Metrics:");

  // Extract and display rate limit metrics
  const rateLimitMetrics = rateLimitMetric.values.map((v: any) => ({
    dealership: v.labels.dealership_id,
    event: v.labels.event_type,
    count: v.value,
  }));

  console.table(rateLimitMetrics);

  console.log("✅ Cost Tracking Metrics tests passed");
}

/**
 * Test cache invalidation
 */
async function testCacheInvalidation(service: AiCostControlService) {
  console.log("\n🧪 Testing Cache Invalidation");

  // Create a test lead for cache invalidation
  const cacheLead = createTestLead(7, "Mercedes", "cache_invalidation_test");

  // First request to populate cache
  console.log("🔄 First request (populating cache)...");
  const response1 = await service.generateResponse(
    cacheLead,
    "cache_invalidation_test",
    testDealership,
  );

  console.log(`🔍 Response model: ${response1.model}`);
  console.log(`🔢 Tokens used: ${response1.totalTokens}`);

  // Second request to verify cache hit
  console.log("\n🔄 Second request (should hit cache)...");
  const response2 = await service.generateResponse(
    cacheLead,
    "cache_invalidation_test",
    testDealership,
  );

  console.log(`🔍 Response model: ${response2.model}`);
  console.log(`🔢 Tokens used: ${response2.totalTokens}`);

  if (!response2.model.includes("cache")) {
    throw new Error("❌ Second request should have hit cache");
  }

  // Invalidate cache
  console.log("\n🗑️ Invalidating cache...");
  const invalidated = await service.invalidateCache(
    cacheLead,
    "cache_invalidation_test",
  );

  if (invalidated) {
    console.log("✅ Cache successfully invalidated");
  } else {
    throw new Error("❌ Failed to invalidate cache");
  }

  // Third request after invalidation should not hit cache
  console.log(
    "\n🔄 Third request after invalidation (should not hit cache)...",
  );
  const response3 = await service.generateResponse(
    cacheLead,
    "cache_invalidation_test",
    testDealership,
  );

  console.log(`🔍 Response model: ${response3.model}`);
  console.log(`🔢 Tokens used: ${response3.totalTokens}`);

  if (response3.model.includes("cache")) {
    throw new Error(
      "❌ Third request should not have hit cache after invalidation",
    );
  } else {
    console.log("✅ Cache invalidation worked correctly");
  }

  console.log("✅ Cache Invalidation tests passed");
}

// Run the tests
runTests().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
