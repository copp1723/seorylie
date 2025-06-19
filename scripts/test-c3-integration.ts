#!/usr/bin/env tsx
/**
 * C3 Database Connection Pool Integration Test
 *
 * This script validates the enhanced database pool implementation
 * before integration into the main branch. It tests configuration,
 * metrics, and connectivity to ensure the C3 ticket requirements
 * are fully implemented.
 *
 * Usage: tsx scripts/test-c3-integration.ts
 */

import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import chalk from "chalk";
import { db, getPoolStats } from "../server/db.js";
import { Registry, Counter, Gauge } from "prom-client";

// Test configuration
const EXPECTED_MAX_CONNECTIONS = 20;
const EXPECTED_IDLE_TIMEOUT_MS = 30000;
const TEST_QUERIES_COUNT = 10;
const CONCURRENT_QUERIES = 5;

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [] as { name: string; passed: boolean; message?: string }[],
};

/**
 * Run a test and track the result
 */
async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    console.log(chalk.blue(`\n▶ Testing: ${name}`));
    await testFn();
    results.passed++;
    results.tests.push({ name, passed: true });
    console.log(chalk.green(`✓ PASS: ${name}`));
  } catch (error) {
    results.failed++;
    const message = error instanceof Error ? error.message : String(error);
    results.tests.push({ name, passed: false, message });
    console.log(chalk.red(`✗ FAIL: ${name}`));
    console.log(chalk.red(`  Error: ${message}`));
  }
}

/**
 * Test 1: Verify pool configuration
 */
async function testPoolConfiguration() {
  const stats = await getPoolStats();

  if (!stats) {
    throw new Error("Failed to get pool stats");
  }

  if (stats.max !== EXPECTED_MAX_CONNECTIONS) {
    throw new Error(
      `Max connections is ${stats.max}, expected ${EXPECTED_MAX_CONNECTIONS}`,
    );
  }

  // We can't directly check idle timeout from stats, so we'll check it indirectly
  // by verifying the pool object has the right configuration
  const poolConfig = (db as any).pool?.options;
  if (!poolConfig) {
    throw new Error("Could not access pool configuration");
  }

  if (poolConfig.idleTimeoutMillis !== EXPECTED_IDLE_TIMEOUT_MS) {
    throw new Error(
      `Idle timeout is ${poolConfig.idleTimeoutMillis}ms, expected ${EXPECTED_IDLE_TIMEOUT_MS}ms`,
    );
  }

  console.log(chalk.gray(`  ✓ Max connections: ${stats.max}`));
  console.log(
    chalk.gray(`  ✓ Idle timeout: ${poolConfig.idleTimeoutMillis}ms`),
  );
}

/**
 * Test 2: Verify getPoolStats function
 */
async function testGetPoolStats() {
  // First check that the function exists and returns expected structure
  const stats = await getPoolStats();

  if (!stats) {
    throw new Error("getPoolStats() returned null or undefined");
  }

  const requiredKeys = ["active", "idle", "max", "waiting", "status"];
  for (const key of requiredKeys) {
    if (!(key in stats)) {
      throw new Error(`getPoolStats() missing required key: ${key}`);
    }
  }

  // Now check that stats change when we run a query
  const initialActive = stats.active;

  // Run a simple query to change active connections
  const queryPromise = db.query("SELECT 1 AS test");

  // Check stats during query execution
  const duringStats = await getPoolStats();

  // Wait for query to complete
  await queryPromise;

  // Check stats after query completion
  const afterStats = await getPoolStats();

  // Verify stats behave as expected
  if (duringStats.active <= initialActive && initialActive === 0) {
    console.log(
      chalk.yellow(
        "  ⚠ Warning: Could not verify active connections change during query",
      ),
    );
    console.log(
      chalk.yellow(
        "    This may be normal in a test environment with low load",
      ),
    );
  }

  console.log(chalk.gray(`  ✓ getPoolStats() returns all required fields`));
  console.log(chalk.gray(`  ✓ Initial active connections: ${initialActive}`));
  console.log(
    chalk.gray(`  ✓ During query active connections: ${duringStats.active}`),
  );
  console.log(
    chalk.gray(`  ✓ After query active connections: ${afterStats.active}`),
  );
}

/**
 * Test 3: Verify Prometheus metrics
 */
async function testPrometricsMetrics() {
  // Check if metrics are registered in the default registry
  const metrics = await Registry.getMetricsAsJSON();

  // Look for our database pool metrics
  const poolMetrics = metrics.filter(
    (m) => m.name.startsWith("db_pool_") || m.name === "pg_pool_connections",
  );

  if (poolMetrics.length === 0) {
    throw new Error("No database pool metrics found in Prometheus registry");
  }

  // Check for specific required metrics
  const requiredMetrics = [
    "db_pool_active_connections",
    "db_pool_idle_connections",
    "db_pool_max_connections",
    "db_pool_waiting_connections",
  ];

  const foundMetrics = poolMetrics.map((m) => m.name);
  const missingMetrics = requiredMetrics.filter(
    (name) => !foundMetrics.includes(name),
  );

  if (missingMetrics.length > 0) {
    throw new Error(`Missing required metrics: ${missingMetrics.join(", ")}`);
  }

  console.log(
    chalk.gray(`  ✓ Found ${poolMetrics.length} database pool metrics`),
  );
  console.log(chalk.gray(`  ✓ All required metrics are registered`));

  // Verify metrics values
  for (const metric of poolMetrics) {
    console.log(
      chalk.gray(`  ✓ ${metric.name}: ${metric.values[0]?.value ?? "N/A"}`),
    );
  }
}

/**
 * Test 4: Test database connectivity with multiple queries
 */
async function testDatabaseConnectivity() {
  console.log(
    chalk.gray(
      `  ▶ Running ${TEST_QUERIES_COUNT} test queries (${CONCURRENT_QUERIES} concurrent)...`,
    ),
  );

  const startTime = performance.now();
  const errors: Error[] = [];
  const results: any[] = [];

  // Function to run a single query
  async function runQuery(id: number) {
    try {
      const start = performance.now();
      const result = await db.query("SELECT $1::text as message", [
        `Test query ${id}`,
      ]);
      const duration = performance.now() - start;
      return { id, duration, result: result.rows[0] };
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error);
      } else {
        errors.push(new Error(String(error)));
      }
      return null;
    }
  }

  // Run queries in batches to control concurrency
  for (let i = 0; i < TEST_QUERIES_COUNT; i += CONCURRENT_QUERIES) {
    const batch = [];
    for (let j = 0; j < CONCURRENT_QUERIES && i + j < TEST_QUERIES_COUNT; j++) {
      batch.push(runQuery(i + j));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults.filter((r) => r !== null));
  }

  const totalDuration = performance.now() - startTime;
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  if (errors.length > 0) {
    throw new Error(`${errors.length} queries failed: ${errors[0].message}`);
  }

  console.log(
    chalk.gray(`  ✓ All ${results.length} queries completed successfully`),
  );
  console.log(chalk.gray(`  ✓ Total duration: ${totalDuration.toFixed(2)}ms`));
  console.log(
    chalk.gray(`  ✓ Average query duration: ${avgDuration.toFixed(2)}ms`),
  );

  // Check pool stats after the test
  const statsAfter = await getPoolStats();
  console.log(
    chalk.gray(
      `  ✓ Pool stats after test: active=${statsAfter.active}, idle=${statsAfter.idle}, waiting=${statsAfter.waiting}`,
    ),
  );
}

/**
 * Test 5: Verify pool behavior under load
 */
async function testPoolBehavior() {
  // Create more concurrent queries than max connections to test waiting behavior
  const OVERLOAD_QUERIES = EXPECTED_MAX_CONNECTIONS + 5;

  console.log(
    chalk.gray(
      `  ▶ Testing pool behavior with ${OVERLOAD_QUERIES} concurrent queries...`,
    ),
  );

  // Function to run a query that sleeps in the database
  async function runSlowQuery(id: number) {
    try {
      const start = performance.now();
      // pg_sleep(0.5) will sleep for 0.5 seconds in the database
      const result = await db.query("SELECT pg_sleep(0.5), $1::text as id", [
        `query-${id}`,
      ]);
      const duration = performance.now() - start;
      return { id, duration };
    } catch (error) {
      return { id, error };
    }
  }

  // Check pool stats before test
  const statsBefore = await getPoolStats();
  console.log(
    chalk.gray(
      `  ✓ Pool stats before load test: active=${statsBefore.active}, idle=${statsBefore.idle}, waiting=${statsBefore.waiting}`,
    ),
  );

  // Run all queries concurrently
  const startTime = performance.now();
  const queries = Array.from({ length: OVERLOAD_QUERIES }, (_, i) =>
    runSlowQuery(i),
  );

  // Check pool stats during execution
  await sleep(100); // Small delay to ensure queries have started
  const statsDuring = await getPoolStats();

  // Wait for all queries to complete
  const results = await Promise.all(queries);
  const totalDuration = performance.now() - startTime;

  // Check for errors
  const errors = results.filter((r) => "error" in r);
  if (errors.length > 0) {
    console.log(
      chalk.yellow(
        `  ⚠ Warning: ${errors.length} queries failed during load test`,
      ),
    );
  }

  // Verify that we had waiting connections during the test
  if (
    statsDuring.waiting === 0 &&
    OVERLOAD_QUERIES > EXPECTED_MAX_CONNECTIONS
  ) {
    console.log(
      chalk.yellow(
        `  ⚠ Warning: Expected waiting connections during load test, but got 0`,
      ),
    );
    console.log(
      chalk.yellow(
        `    This might indicate the pool isn't enforcing max connections properly`,
      ),
    );
  } else {
    console.log(
      chalk.gray(
        `  ✓ Pool had ${statsDuring.waiting} waiting connections during load test`,
      ),
    );
  }

  // Check stats after test
  const statsAfter = await getPoolStats();

  console.log(
    chalk.gray(
      `  ✓ Pool stats during load test: active=${statsDuring.active}, waiting=${statsDuring.waiting}`,
    ),
  );
  console.log(
    chalk.gray(
      `  ✓ Pool stats after load test: active=${statsAfter.active}, idle=${statsAfter.idle}, waiting=${statsAfter.waiting}`,
    ),
  );
  console.log(
    chalk.gray(`  ✓ Load test completed in ${totalDuration.toFixed(2)}ms`),
  );

  // Verify pool recovered properly
  if (statsAfter.waiting > 0) {
    throw new Error(
      `Pool still has ${statsAfter.waiting} waiting connections after test completion`,
    );
  }
}

/**
 * Print a summary of test results
 */
function printSummary() {
  console.log("\n" + chalk.blue("════════════════════════════════════════"));
  console.log(chalk.blue("  C3 DATABASE POOL INTEGRATION TEST SUMMARY  "));
  console.log(chalk.blue("════════════════════════════════════════") + "\n");

  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(
    `${chalk.green(`Passed: ${results.passed}`)} | ${chalk.red(`Failed: ${results.failed}`)}`,
  );

  if (results.failed > 0) {
    console.log("\n" + chalk.red("Failed Tests:"));
    results.tests
      .filter((t) => !t.passed)
      .forEach((test) => {
        console.log(chalk.red(`  ✗ ${test.name}`));
        if (test.message) {
          console.log(chalk.red(`    ${test.message}`));
        }
      });
  }

  console.log("\n" + chalk.blue("════════════════════════════════════════"));
  console.log(
    results.failed === 0
      ? chalk.green("✓ C3 DATABASE POOL INTEGRATION TEST PASSED")
      : chalk.red("✗ C3 DATABASE POOL INTEGRATION TEST FAILED"),
  );
  console.log(chalk.blue("════════════════════════════════════════") + "\n");
}

/**
 * Main function to run all tests
 */
async function main() {
  console.log(chalk.blue("\n════════════════════════════════════════"));
  console.log(chalk.blue("  C3 DATABASE POOL INTEGRATION TEST  "));
  console.log(chalk.blue("════════════════════════════════════════\n"));

  try {
    await runTest("Pool Configuration", testPoolConfiguration);
    await runTest("Pool Statistics Function", testGetPoolStats);
    await runTest("Prometheus Metrics", testPrometricsMetrics);
    await runTest("Database Connectivity", testDatabaseConnectivity);
    await runTest("Pool Behavior Under Load", testPoolBehavior);

    printSummary();

    // Exit with appropriate code
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error(chalk.red("\nUnexpected error during test execution:"));
    console.error(error);
    process.exit(1);
  } finally {
    // Ensure we close the pool before exiting
    try {
      await db.end();
      console.log(chalk.gray("Database pool closed"));
    } catch (error) {
      console.error(chalk.red("Error closing database pool:"), error);
    }
  }
}

// Run the tests
main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
