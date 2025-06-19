#!/usr/bin/env node
/**
 * STAB-104 Performance Tracker Verification Script
 *
 * This script verifies that the performance tracking utility is correctly
 * implemented and that Prometheus metrics are being collected for API response times.
 *
 * It tests:
 * 1. Health endpoints with performance tracking
 * 2. API v1 endpoints with performance tracking
 * 3. Prometheus metrics endpoint to verify metric collection
 *
 * Usage: npx tsx scripts/verify-stab-104-performance-tracking.ts
 */

import fetch from "node-fetch";
import chalk from "chalk";

// Configuration
const BASE_URL = process.env.API_URL || "http://localhost:3000";
const ENDPOINTS = {
  // Health endpoints
  health: "/health",
  healthDb: "/health/db",
  healthReady: "/health/ready",
  healthLive: "/health/live",

  // API v1 endpoints
  apiHealth: "/api/v1/health",
  apiValidate: "/api/v1/validate",

  // Metrics endpoint
  metrics: "/metrics/prometheus",
};

// Metrics to verify
const REQUIRED_METRICS = [
  "http_requests_total", // Count of requests (equivalent to api_response_time_count)
  "http_request_duration_ms", // Histogram of request durations
];

// Required labels
const REQUIRED_LABELS = ["method", "route", "status_code"];

// Test results tracking
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

/**
 * Main verification function
 */
async function verifyPerformanceTracking() {
  console.log(chalk.bold.blue("🔍 STAB-104 Performance Tracker Verification"));
  console.log(chalk.blue("================================================"));
  console.log(chalk.blue(`Testing against API at: ${BASE_URL}`));
  console.log();

  try {
    // Step 1: Make requests to generate metrics
    await testEndpoints();

    // Step 2: Verify metrics collection
    await verifyMetrics();

    // Report results
    reportResults();
  } catch (error) {
    console.error(chalk.red("❌ Verification script failed with an error:"));
    console.error(
      chalk.red(error instanceof Error ? error.stack : String(error)),
    );
    process.exit(1);
  }
}

/**
 * Test all endpoints to generate metrics
 */
async function testEndpoints() {
  console.log(chalk.bold.cyan("📡 Testing endpoints to generate metrics..."));

  // Test health endpoints
  await testEndpoint(ENDPOINTS.health, "Health endpoint");
  await testEndpoint(ENDPOINTS.healthDb, "Health DB endpoint");
  await testEndpoint(ENDPOINTS.healthReady, "Health Ready endpoint");
  await testEndpoint(ENDPOINTS.healthLive, "Health Live endpoint");

  // Test API v1 endpoints
  await testEndpoint(ENDPOINTS.apiHealth, "API v1 Health endpoint");

  // API Validate requires auth, so we'll skip actual testing but note it
  console.log(
    chalk.yellow(
      `⚠️ Skipping ${ENDPOINTS.apiValidate} - requires authentication`,
    ),
  );
  skippedTests++;

  console.log();
}

/**
 * Test a single endpoint and report results
 */
async function testEndpoint(endpoint: string, description: string) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(chalk.cyan(`Testing ${description} (${endpoint})...`));

  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (response.ok) {
      console.log(
        chalk.green(
          `✅ ${description}: ${response.status} ${response.statusText} (${duration}ms)`,
        ),
      );
      passedTests++;
    } else {
      console.log(
        chalk.red(
          `❌ ${description}: ${response.status} ${response.statusText}`,
        ),
      );
      failedTests++;
    }
  } catch (error) {
    console.log(
      chalk.red(
        `❌ ${description}: Failed to connect - ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    failedTests++;
  }
}

/**
 * Verify metrics collection
 */
async function verifyMetrics() {
  console.log(chalk.bold.cyan("📊 Verifying Prometheus metrics collection..."));

  try {
    const url = `${BASE_URL}${ENDPOINTS.metrics}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(
        chalk.red(
          `❌ Metrics endpoint failed: ${response.status} ${response.statusText}`,
        ),
      );
      failedTests++;
      return;
    }

    const metricsText = await response.text();
    console.log(chalk.green(`✅ Metrics endpoint responded successfully`));

    // Parse and verify metrics
    const metricsFound = parseAndVerifyMetrics(metricsText);

    if (metricsFound) {
      console.log(
        chalk.green(`✅ Performance tracking metrics verified successfully`),
      );
      passedTests++;
    } else {
      console.log(
        chalk.red(`❌ Required performance tracking metrics not found`),
      );
      failedTests++;
    }
  } catch (error) {
    console.log(
      chalk.red(
        `❌ Failed to fetch metrics: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    failedTests++;
  }

  console.log();
}

/**
 * Parse Prometheus metrics and verify required metrics and labels
 */
function parseAndVerifyMetrics(metricsText: string): boolean {
  const metrics: Record<string, { found: boolean; labels: string[] }> = {};

  // Initialize tracking for required metrics
  REQUIRED_METRICS.forEach((metric) => {
    metrics[metric] = { found: false, labels: [] };
  });

  // Split by line and process
  const lines = metricsText.split("\n");

  let currentMetric = "";

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line.trim() === "") continue;

    // Check for metric declarations
    const metricMatch = line.match(/^([a-zA-Z0-9_]+)(\{.*\})?\s+/);
    if (metricMatch) {
      const metricName = metricMatch[1];
      currentMetric = metricName;

      // Check if this is one of our required metrics
      if (REQUIRED_METRICS.includes(metricName)) {
        metrics[metricName].found = true;
        console.log(chalk.green(`✅ Found required metric: ${metricName}`));

        // Extract and check labels if present
        const labelsMatch = line.match(/\{([^}]+)\}/);
        if (labelsMatch) {
          const labelsStr = labelsMatch[1];
          const labels = labelsStr.split(",").map((label) => {
            const [key] = label.split("=");
            return key.trim();
          });

          metrics[metricName].labels = [
            ...new Set([...metrics[metricName].labels, ...labels]),
          ];

          // Check for required labels
          const missingLabels = REQUIRED_LABELS.filter(
            (label) => !labels.includes(label),
          );
          if (missingLabels.length === 0) {
            console.log(
              chalk.green(`  ✅ All required labels present for ${metricName}`),
            );
          } else {
            console.log(
              chalk.yellow(
                `  ⚠️ Missing labels for ${metricName}: ${missingLabels.join(", ")}`,
              ),
            );
          }
        }
      }
    }
  }

  // Verify all required metrics were found
  const missingMetrics = REQUIRED_METRICS.filter(
    (metric) => !metrics[metric].found,
  );

  if (missingMetrics.length > 0) {
    console.log(
      chalk.red(`❌ Missing required metrics: ${missingMetrics.join(", ")}`),
    );
    return false;
  }

  // Verify all metrics have all required labels
  let allLabelsPresent = true;

  for (const metric of REQUIRED_METRICS) {
    if (!metrics[metric].found) continue;

    const missingLabels = REQUIRED_LABELS.filter(
      (label) => !metrics[metric].labels.includes(label),
    );
    if (missingLabels.length > 0) {
      console.log(
        chalk.yellow(
          `⚠️ Metric ${metric} is missing labels: ${missingLabels.join(", ")}`,
        ),
      );
      allLabelsPresent = false;
    }
  }

  // Check for specific route labels from our test endpoints
  const routeLabelsFound = lines.some(
    (line) =>
      (line.includes('route="/health"') ||
        line.includes('route="/api/v1/health"')) &&
      (line.includes("http_requests_total") ||
        line.includes("http_request_duration_ms")),
  );

  if (routeLabelsFound) {
    console.log(chalk.green("✅ Found metrics with test endpoint routes"));
  } else {
    console.log(
      chalk.yellow("⚠️ Could not find metrics for test endpoint routes"),
    );
    allLabelsPresent = false;
  }

  return allLabelsPresent;
}

/**
 * Report final test results
 */
function reportResults() {
  console.log(chalk.bold.blue("📋 STAB-104 Verification Results"));
  console.log(chalk.blue("================================"));
  console.log(chalk.green(`✅ Passed: ${passedTests} tests`));

  if (failedTests > 0) {
    console.log(chalk.red(`❌ Failed: ${failedTests} tests`));
  } else {
    console.log(chalk.green(`❌ Failed: ${failedTests} tests`));
  }

  if (skippedTests > 0) {
    console.log(chalk.yellow(`⚠️ Skipped: ${skippedTests} tests`));
  }

  console.log();

  if (failedTests > 0) {
    console.log(chalk.red.bold("❌ STAB-104 VERIFICATION FAILED"));
    process.exit(1);
  } else {
    console.log(chalk.green.bold("✅ STAB-104 VERIFICATION PASSED"));
    console.log(
      chalk.green(
        "Performance tracking is correctly implemented and metrics are being collected.",
      ),
    );
    process.exit(0);
  }
}

// Run the verification
verifyPerformanceTracking().catch((error) => {
  console.error("Unhandled error in verification script:", error);
  process.exit(1);
});
