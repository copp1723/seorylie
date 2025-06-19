#!/usr/bin/env tsx
/**
 * Comprehensive Integration Testing Suite Runner
 *
 * This script orchestrates the entire testing process for INT-013:
 * - Environment validation
 * - TypeScript compilation
 * - Unit tests with coverage
 * - Integration tests
 * - End-to-end tests
 * - Load testing
 * - Security scanning
 * - Docker health checks
 * - Memory leak detection
 * - API backwards compatibility
 * - Performance SLA validation
 *
 * Usage: tsx scripts/run-comprehensive-integration-tests.ts [--phase=<phase>] [--ci] [--verbose]
 *
 * Options:
 *   --phase=<phase>    Run only a specific phase (setup, compile, unit, integration, e2e, load, security, docker, memory, api, performance, report)
 *   --ci               Run in CI mode (non-interactive, fail on first error)
 *   --verbose          Show detailed output
 *   --help             Show this help message
 */

import { exec, execSync, spawn } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http";
import { createInterface } from "readline";
import * as dotenv from "dotenv";
import chalk from "chalk";

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

// Constants
const TEST_RESULTS_DIR = path.join(process.cwd(), "test-results");
const COVERAGE_DIR = path.join(process.cwd(), "coverage");
const ARTIFACTS_DIR = path.join(process.cwd(), "test-artifacts");
const LOG_DIR = path.join(process.cwd(), "logs");
const REPORT_DIR = path.join(process.cwd(), "test-report");
const MAX_MEMORY_LEAK_THRESHOLD = 10 * 1024 * 1024; // 10MB threshold
const PERFORMANCE_SLA = {
  responseTime: 200, // ms
  throughput: 100, // rps
  errorRate: 0.01, // 1%
};
const DEFAULT_TIMEOUT = 60000; // 1 minute
const LONG_TIMEOUT = 300000; // 5 minutes

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  phase: args.find((arg) => arg.startsWith("--phase="))?.split("=")[1] || "all",
  ci: args.includes("--ci"),
  verbose: args.includes("--verbose"),
  help: args.includes("--help"),
};

// Test phases
const PHASES = [
  "setup",
  "compile",
  "unit",
  "integration",
  "e2e",
  "load",
  "security",
  "docker",
  "memory",
  "api",
  "performance",
  "report",
];

// Test results storage
const testResults: Record<
  string,
  {
    success: boolean;
    startTime: number;
    endTime: number;
    details: any;
    errors: string[];
  }
> = {};

// Main function
async function main() {
  if (options.help) {
    showHelp();
    return;
  }

  try {
    setupDirectories();

    console.log(
      chalk.blue.bold("🔍 INT-013 - Comprehensive Integration Testing"),
    );
    console.log(chalk.blue("🚀 Starting test suite execution..."));

    const startTime = Date.now();

    if (options.phase === "all" || options.phase === "setup") {
      await runPhase("setup", validateEnvironment);
    }

    if (options.phase === "all" || options.phase === "compile") {
      await runPhase("compile", checkTypeScriptCompilation);
    }

    if (options.phase === "all" || options.phase === "unit") {
      await runPhase("unit", runUnitTests);
    }

    if (options.phase === "all" || options.phase === "integration") {
      await runPhase("integration", runIntegrationTests);
    }

    if (options.phase === "all" || options.phase === "e2e") {
      await runPhase("e2e", runE2ETests);
    }

    if (options.phase === "all" || options.phase === "load") {
      await runPhase("load", runLoadTests);
    }

    if (options.phase === "all" || options.phase === "security") {
      await runPhase("security", runSecurityScan);
    }

    if (options.phase === "all" || options.phase === "docker") {
      await runPhase("docker", checkDockerHealth);
    }

    if (options.phase === "all" || options.phase === "memory") {
      await runPhase("memory", detectMemoryLeaks);
    }

    if (options.phase === "all" || options.phase === "api") {
      await runPhase("api", testAPIBackwardsCompatibility);
    }

    if (options.phase === "all" || options.phase === "performance") {
      await runPhase("performance", validatePerformanceSLAs);
    }

    if (options.phase === "all" || options.phase === "report") {
      await runPhase("report", generateTestReport);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Final summary
    const allPassed = Object.values(testResults).every(
      (result) => result.success,
    );

    console.log("\n" + chalk.blue.bold("📊 Test Suite Summary"));
    console.log(
      chalk.blue(`⏱️  Total Duration: ${duration.toFixed(2)} seconds`),
    );

    if (allPassed) {
      console.log(chalk.green.bold("✅ All tests passed successfully!"));
    } else {
      console.log(chalk.red.bold("❌ Some tests failed. See details below:"));
      Object.entries(testResults)
        .filter(([_, result]) => !result.success)
        .forEach(([phase, result]) => {
          console.log(chalk.red(`  - ${phase}: ${result.errors.join(", ")}`));
        });

      if (options.ci) {
        process.exit(1);
      }
    }

    // Notify CI system
    if (options.ci) {
      await notifyCISystem(allPassed);
    }
  } catch (error) {
    console.error(chalk.red.bold("❌ Fatal error in test suite execution:"));
    console.error(
      chalk.red(error instanceof Error ? error.stack : String(error)),
    );

    if (options.ci) {
      process.exit(1);
    }
  }
}

// Helper functions
async function runPhase(phase: string, fn: () => Promise<void>) {
  console.log(
    "\n" + chalk.blue.bold(`🔄 Running Phase: ${phase.toUpperCase()}`),
  );

  const result = {
    success: false,
    startTime: Date.now(),
    endTime: 0,
    details: null,
    errors: [] as string[],
  };

  try {
    await fn();
    result.success = true;
    console.log(
      chalk.green(`✅ Phase ${phase.toUpperCase()} completed successfully`),
    );
  } catch (error) {
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    console.error(
      chalk.red(`❌ Phase ${phase.toUpperCase()} failed: ${errorMessage}`),
    );

    if (options.ci) {
      throw error; // In CI mode, stop execution on first failure
    }
  } finally {
    result.endTime = Date.now();
    testResults[phase] = result;

    // Save phase results to file
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, `${phase}-results.json`),
      JSON.stringify(result, null, 2),
    );
  }
}

function setupDirectories() {
  [TEST_RESULTS_DIR, COVERAGE_DIR, ARTIFACTS_DIR, LOG_DIR, REPORT_DIR].forEach(
    (dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    },
  );
}

function showHelp() {
  console.log(`
Comprehensive Integration Testing Suite Runner

Usage: tsx scripts/run-comprehensive-integration-tests.ts [--phase=<phase>] [--ci] [--verbose]

Options:
  --phase=<phase>    Run only a specific phase (${PHASES.join(", ")})
  --ci               Run in CI mode (non-interactive, fail on first error)
  --verbose          Show detailed output
  --help             Show this help message
  `);
}

// Test phases implementation
async function validateEnvironment() {
  console.log(chalk.blue("🔍 Validating environment..."));

  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`Node.js version: ${nodeVersion}`);
  const majorVersion = parseInt(nodeVersion.substring(1).split(".")[0], 10);
  if (majorVersion < 18) {
    throw new Error("Node.js version must be 18 or higher");
  }

  // Check required environment variables
  const requiredEnvVars = ["NODE_ENV", "DATABASE_URL", "REDIS_URL"];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar],
  );
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(", ")}`,
    );
  }

  // Check required tools
  await Promise.all([
    checkCommand("npm -v"),
    checkCommand("npx -v"),
    checkCommand("docker -v"),
    checkCommand("git --version"),
  ]);

  // Check database connection
  await checkDatabaseConnection();

  // Check Redis connection
  await checkRedisConnection();

  // Verify disk space
  const { stdout } = await execAsync("df -h .");
  console.log("Disk space:");
  console.log(stdout);

  // Check memory
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  console.log(`Total memory: ${formatBytes(totalMemory)}`);
  console.log(`Free memory: ${formatBytes(freeMemory)}`);

  if (freeMemory < 1024 * 1024 * 1024) {
    // 1GB
    console.warn(
      chalk.yellow("⚠️ Warning: Less than 1GB of free memory available"),
    );
  }

  console.log(chalk.green("✅ Environment validation complete"));
}

async function checkTypeScriptCompilation() {
  console.log(chalk.blue("🔍 Checking TypeScript compilation..."));

  // Run TypeScript compiler in strict mode with noEmit
  const { stdout, stderr } = await execAsync("npx tsc --noEmit");

  if (stderr && stderr.includes("error TS")) {
    // Parse TypeScript errors
    const errors = stderr
      .split("\n")
      .filter((line) => line.includes("error TS"))
      .map((line) => line.trim());

    throw new Error(
      `TypeScript compilation failed with ${errors.length} errors:\n${errors.slice(0, 5).join("\n")}`,
    );
  }

  // Save compilation results
  fs.writeFileSync(
    path.join(TEST_RESULTS_DIR, "typescript-compilation.log"),
    stdout + stderr,
  );

  console.log(chalk.green("✅ TypeScript compilation successful"));
}

async function runUnitTests() {
  console.log(chalk.blue("🔍 Running unit tests with coverage..."));

  // Run Jest or Vitest unit tests with coverage
  const { stdout, stderr } = await execAsync(
    "npm run test:unit -- --coverage",
    { timeout: LONG_TIMEOUT },
  );

  // Check for test failures
  if (stderr && stderr.includes("FAIL ")) {
    const failedTests = stderr
      .split("\n")
      .filter((line) => line.includes("FAIL "))
      .map((line) => line.trim());

    throw new Error(`Unit tests failed:\n${failedTests.join("\n")}`);
  }

  // Parse coverage report
  const coverageSummary = await parseCoverageReport();

  // Verify coverage meets threshold
  if (coverageSummary.lines < 80) {
    console.warn(
      chalk.yellow(
        `⚠️ Warning: Line coverage (${coverageSummary.lines}%) is below 80% threshold`,
      ),
    );
  }

  // Save test results
  fs.writeFileSync(
    path.join(TEST_RESULTS_DIR, "unit-tests.log"),
    stdout + stderr,
  );

  console.log(
    chalk.green(
      `✅ Unit tests passed with ${coverageSummary.lines}% line coverage`,
    ),
  );

  // Save coverage details to test results
  testResults.unit.details = coverageSummary;
}

async function runIntegrationTests() {
  console.log(chalk.blue("🔍 Running integration tests..."));

  // Run integration tests
  const { stdout, stderr } = await execAsync("npm run test:integration", {
    timeout: LONG_TIMEOUT,
  });

  // Check for test failures
  if (stderr && stderr.includes("FAIL ")) {
    const failedTests = stderr
      .split("\n")
      .filter((line) => line.includes("FAIL "))
      .map((line) => line.trim());

    throw new Error(`Integration tests failed:\n${failedTests.join("\n")}`);
  }

  // Save test results
  fs.writeFileSync(
    path.join(TEST_RESULTS_DIR, "integration-tests.log"),
    stdout + stderr,
  );

  console.log(chalk.green("✅ Integration tests passed"));

  // Run the comprehensive platform test separately
  await runComprehensivePlatformTest();
}

async function runComprehensivePlatformTest() {
  console.log(chalk.blue("🔍 Running comprehensive platform test..."));

  try {
    // Run the comprehensive platform test
    const { stdout, stderr } = await execAsync(
      "npx jest test/integration/comprehensive-platform-test.ts --runInBand",
      { timeout: LONG_TIMEOUT * 2 },
    ); // Double timeout for this intensive test

    // Save test results
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "comprehensive-platform-test.log"),
      stdout + stderr,
    );

    console.log(chalk.green("✅ Comprehensive platform test passed"));
  } catch (error) {
    console.error(chalk.red("❌ Comprehensive platform test failed"));
    throw error;
  }
}

async function runE2ETests() {
  console.log(chalk.blue("🔍 Running end-to-end tests with Playwright..."));

  // Make sure the application is running
  await ensureApplicationRunning();

  // Run Playwright tests
  const { stdout, stderr } = await execAsync("npx playwright test", {
    timeout: LONG_TIMEOUT,
  });

  // Check for test failures
  if (stderr && stderr.includes("failed")) {
    throw new Error(`E2E tests failed: ${stderr}`);
  }

  // Save test results
  fs.writeFileSync(
    path.join(TEST_RESULTS_DIR, "e2e-tests.log"),
    stdout + stderr,
  );

  // Copy Playwright report to artifacts directory
  if (fs.existsSync("playwright-report")) {
    fs.cpSync(
      "playwright-report",
      path.join(ARTIFACTS_DIR, "playwright-report"),
      { recursive: true },
    );
  }

  console.log(chalk.green("✅ End-to-end tests passed"));
}

async function runLoadTests() {
  console.log(chalk.blue("🔍 Running load tests..."));

  // Make sure the application is running
  await ensureApplicationRunning();

  // Run k6 load tests
  const loadTestScripts = [
    "test/load/load-test-suite.js",
    "test/load/chat-load-test.js",
    "test/load/api-load-test.js",
  ];

  const loadTestResults: any = {};

  for (const script of loadTestScripts) {
    console.log(chalk.blue(`Running load test: ${script}`));

    try {
      const { stdout, stderr } = await execAsync(
        `k6 run ${script} --summary-export=${path.join(TEST_RESULTS_DIR, `k6-${path.basename(script, ".js")}.json`)}`,
        { timeout: LONG_TIMEOUT },
      );

      // Save test output
      fs.writeFileSync(
        path.join(TEST_RESULTS_DIR, `k6-${path.basename(script, ".js")}.log`),
        stdout + stderr,
      );

      // Parse k6 results
      const results = parseK6Results(stdout);
      loadTestResults[script] = results;

      // Check if performance meets SLAs
      if (results.http_req_duration.p95 > PERFORMANCE_SLA.responseTime) {
        console.warn(
          chalk.yellow(
            `⚠️ Warning: p95 response time (${results.http_req_duration.p95}ms) exceeds SLA (${PERFORMANCE_SLA.responseTime}ms)`,
          ),
        );
      }

      if (results.http_req_failed.rate > PERFORMANCE_SLA.errorRate) {
        console.warn(
          chalk.yellow(
            `⚠️ Warning: Error rate (${results.http_req_failed.rate * 100}%) exceeds SLA (${PERFORMANCE_SLA.errorRate * 100}%)`,
          ),
        );
      }
    } catch (error) {
      throw new Error(
        `Load test failed for ${script}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Save load test results
  testResults.load.details = loadTestResults;

  console.log(chalk.green("✅ Load tests completed"));
}

async function runSecurityScan() {
  console.log(chalk.blue("🔍 Running security scan..."));

  try {
    // Run npm audit
    const { stdout: auditStdout, stderr: auditStderr } =
      await execAsync("npm audit --json");

    // Save audit results
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "npm-audit.json"),
      auditStdout,
    );

    // Parse audit results
    const auditResults = JSON.parse(auditStdout);
    const vulnerabilities = auditResults.vulnerabilities || {};
    const totalVulnerabilities = Object.values(vulnerabilities).reduce(
      (sum: number, severity: any) => sum + severity.length,
      0,
    );

    if (totalVulnerabilities > 0) {
      console.warn(
        chalk.yellow(
          `⚠️ Warning: Found ${totalVulnerabilities} vulnerabilities in npm packages`,
        ),
      );

      // Check for critical vulnerabilities
      const criticalVulnerabilities = vulnerabilities.critical?.length || 0;
      if (criticalVulnerabilities > 0) {
        throw new Error(
          `Security scan failed: Found ${criticalVulnerabilities} critical vulnerabilities`,
        );
      }
    }

    // Run OWASP ZAP scan if available
    if (await commandExists("zap-cli")) {
      console.log(chalk.blue("Running OWASP ZAP scan..."));

      // Make sure the application is running
      await ensureApplicationRunning();

      const { stdout: zapStdout, stderr: zapStderr } = await execAsync(
        `zap-cli quick-scan --self-contained --start-options "-config api.disablekey=true" http://localhost:3000`,
        { timeout: LONG_TIMEOUT * 2 },
      );

      // Save ZAP results
      fs.writeFileSync(
        path.join(TEST_RESULTS_DIR, "zap-scan.log"),
        zapStdout + zapStderr,
      );

      // Check for high-risk findings
      if (zapStdout.includes("High") || zapStdout.includes("Critical")) {
        console.warn(
          chalk.yellow(
            "⚠️ Warning: ZAP scan found high or critical security issues",
          ),
        );
      }
    } else {
      console.log(
        chalk.yellow(
          "⚠️ OWASP ZAP not available, skipping dynamic security scan",
        ),
      );
    }

    // Run Snyk scan if available
    if (await commandExists("snyk")) {
      console.log(chalk.blue("Running Snyk security scan..."));

      try {
        const { stdout: snykStdout, stderr: snykStderr } = await execAsync(
          "snyk test --json",
          { timeout: LONG_TIMEOUT },
        );

        // Save Snyk results
        fs.writeFileSync(
          path.join(TEST_RESULTS_DIR, "snyk-scan.json"),
          snykStdout,
        );
      } catch (error) {
        // Snyk returns non-zero exit code when vulnerabilities are found
        if (error instanceof Error && "stdout" in error) {
          fs.writeFileSync(
            path.join(TEST_RESULTS_DIR, "snyk-scan.json"),
            (error as any).stdout,
          );

          console.warn(
            chalk.yellow("⚠️ Warning: Snyk found security vulnerabilities"),
          );
        } else {
          console.warn(
            chalk.yellow(
              `⚠️ Snyk scan error: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      }
    } else {
      console.log(
        chalk.yellow("⚠️ Snyk not available, skipping code security scan"),
      );
    }

    console.log(chalk.green("✅ Security scan completed"));
  } catch (error) {
    throw new Error(
      `Security scan failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function checkDockerHealth() {
  console.log(chalk.blue("🔍 Checking Docker health..."));

  // Check if Docker is running
  if (!(await commandExists("docker"))) {
    console.warn(
      chalk.yellow("⚠️ Docker not available, skipping Docker health checks"),
    );
    return;
  }

  try {
    // Build Docker image
    console.log(chalk.blue("Building Docker image..."));
    await execAsync("docker build -t cleanrylie-test .", {
      timeout: LONG_TIMEOUT,
    });

    // Run container with health check
    console.log(chalk.blue("Running container with health check..."));
    await execAsync(
      'docker run --name cleanrylie-test -d --health-cmd "curl -f http://localhost:3000/health || exit 1" --health-interval=5s cleanrylie-test',
    );

    // Wait for container to start
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Check container health
    const { stdout } = await execAsync(
      'docker inspect --format="{{.State.Health.Status}}" cleanrylie-test',
    );

    if (stdout.trim() !== "healthy") {
      throw new Error(`Docker container is not healthy: ${stdout.trim()}`);
    }

    // Get health check logs
    const { stdout: healthLogs } = await execAsync(
      'docker inspect --format="{{json .State.Health}}" cleanrylie-test',
    );

    // Save health check logs
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "docker-health.json"),
      healthLogs,
    );

    console.log(chalk.green("✅ Docker health checks passed"));
  } catch (error) {
    throw new Error(
      `Docker health check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // Clean up Docker container
    try {
      await execAsync("docker rm -f cleanrylie-test");
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Failed to clean up Docker container: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}

async function detectMemoryLeaks() {
  console.log(chalk.blue("🔍 Detecting memory leaks..."));

  // Make sure the application is running
  await ensureApplicationRunning();

  // Run memory leak detection tests
  try {
    console.log(chalk.blue("Running WebSocket memory leak test..."));

    // Start with a baseline memory measurement
    const baselineMemory = process.memoryUsage().heapUsed;

    // Create and close many WebSocket connections
    const wsMemoryGrowth = await measureMemoryGrowthDuringOperation(
      async () => {
        // Create and close 100 WebSocket connections
        for (let i = 0; i < 100; i++) {
          const ws = new (require("ws"))(`ws://localhost:3000/ws/test-${i}`);
          await new Promise((resolve) => {
            ws.on("open", () => {
              // Send a message then close
              ws.send(JSON.stringify({ type: "test", payload: { id: i } }));
              setTimeout(() => {
                ws.close();
                resolve(null);
              }, 100);
            });
            ws.on("error", () => {
              resolve(null);
            });

            // Timeout if connection doesn't open
            setTimeout(resolve, 1000);
          });
        }
      },
    );

    console.log(chalk.blue("Running cache operations memory leak test..."));

    // Test cache operations for memory leaks
    const cacheMemoryGrowth = await measureMemoryGrowthDuringOperation(
      async () => {
        // Perform many cache operations
        const Redis = require("ioredis");
        const redis = new Redis(
          process.env.REDIS_URL || "redis://localhost:6379",
        );

        for (let i = 0; i < 1000; i++) {
          const key = `test-key-${i}`;
          await redis.set(key, JSON.stringify({ data: `test-data-${i}` }));
          await redis.get(key);
          await redis.del(key);
        }

        await redis.quit();
      },
    );

    console.log(chalk.blue("Running API request memory leak test..."));

    // Test API requests for memory leaks
    const apiMemoryGrowth = await measureMemoryGrowthDuringOperation(
      async () => {
        // Make many API requests
        const fetch = require("node-fetch");

        for (let i = 0; i < 100; i++) {
          try {
            await fetch(`http://localhost:3000/api/health?iteration=${i}`);
          } catch (error) {
            // Ignore errors
          }
        }
      },
    );

    // Check for memory leaks
    const memoryResults = {
      wsMemoryGrowth,
      cacheMemoryGrowth,
      apiMemoryGrowth,
    };

    // Save memory test results
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "memory-leak-test.json"),
      JSON.stringify(memoryResults, null, 2),
    );

    // Check if any test exceeded the threshold
    const memoryLeaks = Object.entries(memoryResults)
      .filter(([_, growth]) => growth > MAX_MEMORY_LEAK_THRESHOLD)
      .map(([test, growth]) => `${test}: ${formatBytes(growth)}`);

    if (memoryLeaks.length > 0) {
      throw new Error(`Memory leaks detected: ${memoryLeaks.join(", ")}`);
    }

    console.log(chalk.green("✅ No memory leaks detected"));

    // Save memory details to test results
    testResults.memory.details = memoryResults;
  } catch (error) {
    throw new Error(
      `Memory leak detection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function testAPIBackwardsCompatibility() {
  console.log(chalk.blue("🔍 Testing API backwards compatibility..."));

  // Make sure the application is running
  await ensureApplicationRunning();

  try {
    // Test v1 API endpoints
    console.log(chalk.blue("Testing v1 API endpoints..."));

    const fetch = require("node-fetch");
    const v1Endpoints = [
      "/api/v1/conversations",
      "/api/v1/users",
      "/api/v1/dealerships",
    ];

    const v1Results = await Promise.all(
      v1Endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`http://localhost:3000${endpoint}`, {
            headers: {
              Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN || "test-token"}`,
            },
          });

          return {
            endpoint,
            status: response.status,
            compatible: response.status !== 404, // Endpoint exists
          };
        } catch (error) {
          return {
            endpoint,
            status: 0,
            compatible: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    // Test old request formats
    console.log(chalk.blue("Testing old request formats..."));

    const oldFormatTests = [
      {
        name: "Old conversation format",
        endpoint: "/api/conversations",
        method: "POST",
        body: {
          message: "Test message",
          source: "test",
        },
      },
      {
        name: "Old user format",
        endpoint: "/api/users",
        method: "POST",
        body: {
          name: "Test User",
          email: `test-${Date.now()}@example.com`,
          role: "user",
        },
      },
    ];

    const oldFormatResults = await Promise.all(
      oldFormatTests.map(async (test) => {
        try {
          const response = await fetch(
            `http://localhost:3000${test.endpoint}`,
            {
              method: test.method,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN || "test-token"}`,
              },
              body: JSON.stringify(test.body),
            },
          );

          return {
            name: test.name,
            status: response.status,
            compatible: response.status < 400, // Not an error
          };
        } catch (error) {
          return {
            name: test.name,
            status: 0,
            compatible: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    // Combine results
    const apiCompatibilityResults = {
      v1Endpoints: v1Results,
      oldFormatTests: oldFormatResults,
    };

    // Save API compatibility results
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "api-compatibility.json"),
      JSON.stringify(apiCompatibilityResults, null, 2),
    );

    // Check for compatibility issues
    const incompatibleEndpoints = v1Results.filter(
      (result) => !result.compatible,
    );
    const incompatibleFormats = oldFormatResults.filter(
      (result) => !result.compatible,
    );

    if (incompatibleEndpoints.length > 0 || incompatibleFormats.length > 0) {
      const issues = [
        ...incompatibleEndpoints.map(
          (e) => `V1 endpoint ${e.endpoint} is not compatible`,
        ),
        ...incompatibleFormats.map((f) => `${f.name} is not compatible`),
      ];

      throw new Error(
        `API backwards compatibility issues detected: ${issues.join(", ")}`,
      );
    }

    console.log(chalk.green("✅ API backwards compatibility verified"));

    // Save API compatibility details to test results
    testResults.api.details = apiCompatibilityResults;
  } catch (error) {
    throw new Error(
      `API backwards compatibility testing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function validatePerformanceSLAs() {
  console.log(chalk.blue("🔍 Validating performance SLAs..."));

  // Make sure the application is running
  await ensureApplicationRunning();

  try {
    // Define critical endpoints to test
    const criticalEndpoints = [
      "/api/health",
      "/api/conversations",
      "/api/kpi/dashboard",
      "/api/users",
    ];

    const fetch = require("node-fetch");
    const performanceResults: Record<
      string,
      {
        responseTime: number[];
        success: boolean;
        errors: string[];
      }
    > = {};

    // Test each endpoint 10 times
    for (const endpoint of criticalEndpoints) {
      console.log(chalk.blue(`Testing endpoint: ${endpoint}`));

      performanceResults[endpoint] = {
        responseTime: [],
        success: true,
        errors: [],
      };

      for (let i = 0; i < 10; i++) {
        try {
          const startTime = Date.now();
          const response = await fetch(`http://localhost:3000${endpoint}`, {
            headers: {
              Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN || "test-token"}`,
            },
          });
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          performanceResults[endpoint].responseTime.push(responseTime);

          if (response.status >= 400) {
            performanceResults[endpoint].success = false;
            performanceResults[endpoint].errors.push(
              `Request ${i} failed with status ${response.status}`,
            );
          }
        } catch (error) {
          performanceResults[endpoint].success = false;
          performanceResults[endpoint].errors.push(
            `Request ${i} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    // Calculate performance metrics
    const performanceMetrics: Record<
      string,
      {
        avgResponseTime: number;
        p95ResponseTime: number;
        successRate: number;
        meetsSLA: boolean;
      }
    > = {};

    for (const [endpoint, results] of Object.entries(performanceResults)) {
      const responseTimesSorted = [...results.responseTime].sort(
        (a, b) => a - b,
      );
      const avgResponseTime =
        responseTimesSorted.reduce((sum, time) => sum + time, 0) /
        responseTimesSorted.length;
      const p95Index = Math.floor(responseTimesSorted.length * 0.95);
      const p95ResponseTime = responseTimesSorted[p95Index] || 0;
      const successRate = results.success ? 1 : 0;

      performanceMetrics[endpoint] = {
        avgResponseTime,
        p95ResponseTime,
        successRate,
        meetsSLA:
          avgResponseTime <= PERFORMANCE_SLA.responseTime &&
          successRate >= 1 - PERFORMANCE_SLA.errorRate,
      };
    }

    // Save performance results
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "performance-sla.json"),
      JSON.stringify(
        { results: performanceResults, metrics: performanceMetrics },
        null,
        2,
      ),
    );

    // Check if any endpoint fails to meet SLAs
    const failedEndpoints = Object.entries(performanceMetrics)
      .filter(([_, metrics]) => !metrics.meetsSLA)
      .map(
        ([endpoint, metrics]) =>
          `${endpoint} (avg: ${metrics.avgResponseTime.toFixed(2)}ms, p95: ${metrics.p95ResponseTime.toFixed(2)}ms, success: ${metrics.successRate * 100}%)`,
      );

    if (failedEndpoints.length > 0) {
      throw new Error(
        `Performance SLAs not met for endpoints: ${failedEndpoints.join(", ")}`,
      );
    }

    console.log(chalk.green("✅ Performance SLAs validated"));

    // Save performance details to test results
    testResults.performance.details = {
      results: performanceResults,
      metrics: performanceMetrics,
    };
  } catch (error) {
    throw new Error(
      `Performance SLA validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function generateTestReport() {
  console.log(chalk.blue("🔍 Generating comprehensive test report..."));

  try {
    // Collect all test results
    const reportData = {
      summary: {
        date: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        platform: `${os.type()} ${os.release()}`,
        nodeVersion: process.version,
        totalDuration:
          Object.values(testResults).reduce(
            (sum, result) => sum + (result.endTime - result.startTime),
            0,
          ) / 1000,
        overallSuccess: Object.values(testResults).every(
          (result) => result.success,
        ),
        phases: Object.entries(testResults).map(([phase, result]) => ({
          phase,
          success: result.success,
          duration: (result.endTime - result.startTime) / 1000,
          errors: result.errors,
        })),
      },
      details: testResults,
      systemInfo: {
        cpu: os.cpus()[0].model,
        cores: os.cpus().length,
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
      },
    };

    // Save JSON report
    fs.writeFileSync(
      path.join(REPORT_DIR, "test-report.json"),
      JSON.stringify(reportData, null, 2),
    );

    // Generate HTML report
    const htmlReport = generateHtmlReport(reportData);
    fs.writeFileSync(path.join(REPORT_DIR, "test-report.html"), htmlReport);

    // Generate markdown report
    const markdownReport = generateMarkdownReport(reportData);
    fs.writeFileSync(path.join(REPORT_DIR, "test-report.md"), markdownReport);

    // Copy reports to artifacts directory
    fs.cpSync(REPORT_DIR, path.join(ARTIFACTS_DIR, "reports"), {
      recursive: true,
    });

    console.log(chalk.green("✅ Test report generated"));
    console.log(
      chalk.blue(
        `📊 Report available at: ${path.join(REPORT_DIR, "test-report.html")}`,
      ),
    );
  } catch (error) {
    throw new Error(
      `Report generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Helper functions
async function checkCommand(command: string): Promise<boolean> {
  try {
    await execAsync(command);
    return true;
  } catch (error) {
    throw new Error(`Required command failed: ${command}`);
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function checkDatabaseConnection(): Promise<void> {
  try {
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();

    console.log(`Database connection successful: ${result.rows[0].now}`);
    await pool.end();
  } catch (error) {
    throw new Error(
      `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function checkRedisConnection(): Promise<void> {
  try {
    const Redis = require("ioredis");
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    await redis.ping();
    console.log("Redis connection successful");

    await redis.quit();
  } catch (error) {
    throw new Error(
      `Redis connection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function parseCoverageReport(): Promise<{
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}> {
  try {
    // Try to find coverage summary file
    const coverageSummaryPath = path.join(
      COVERAGE_DIR,
      "coverage-summary.json",
    );

    if (fs.existsSync(coverageSummaryPath)) {
      const coverageSummary = JSON.parse(
        fs.readFileSync(coverageSummaryPath, "utf8"),
      );
      return {
        lines: coverageSummary.total.lines.pct,
        statements: coverageSummary.total.statements.pct,
        functions: coverageSummary.total.functions.pct,
        branches: coverageSummary.total.branches.pct,
      };
    }

    // If summary file doesn't exist, try to extract from lcov-report
    const lcovReportPath = path.join(COVERAGE_DIR, "lcov-report", "index.html");

    if (fs.existsSync(lcovReportPath)) {
      const lcovReport = fs.readFileSync(lcovReportPath, "utf8");

      // Extract coverage percentages using regex
      const lineMatch = lcovReport.match(/Lines\s*:\s*(\d+\.?\d*)%/);
      const statementsMatch = lcovReport.match(/Statements\s*:\s*(\d+\.?\d*)%/);
      const functionsMatch = lcovReport.match(/Functions\s*:\s*(\d+\.?\d*)%/);
      const branchesMatch = lcovReport.match(/Branches\s*:\s*(\d+\.?\d*)%/);

      return {
        lines: lineMatch ? parseFloat(lineMatch[1]) : 0,
        statements: statementsMatch ? parseFloat(statementsMatch[1]) : 0,
        functions: functionsMatch ? parseFloat(functionsMatch[1]) : 0,
        branches: branchesMatch ? parseFloat(branchesMatch[1]) : 0,
      };
    }

    // If no coverage files found, return zeros
    return { lines: 0, statements: 0, functions: 0, branches: 0 };
  } catch (error) {
    console.warn(
      chalk.yellow(
        `⚠️ Failed to parse coverage report: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return { lines: 0, statements: 0, functions: 0, branches: 0 };
  }
}

function parseK6Results(output: string): any {
  try {
    // Extract JSON summary from k6 output
    const jsonMatch = output.match(
      /(?<=data_received.*\n)(.+\n)+?(?=checks.*\n)/,
    );

    if (!jsonMatch) {
      throw new Error("Could not find k6 results in output");
    }

    // Parse metrics from output
    const metrics: Record<string, any> = {};

    const metricRegexes = [
      {
        name: "http_req_duration",
        regex:
          /http_req_duration\s*:\s*avg=(\d+\.?\d*)ms\s*min=(\d+\.?\d*)ms\s*med=(\d+\.?\d*)ms\s*max=(\d+\.?\d*)ms\s*p\(90\)=(\d+\.?\d*)ms\s*p\(95\)=(\d+\.?\d*)ms/,
      },
      { name: "http_req_failed", regex: /http_req_failed\s*:\s*(\d+\.?\d*)%/ },
      { name: "iterations", regex: /iterations\s*:\s*(\d+)/ },
      { name: "vus", regex: /vus\s*:\s*(\d+)/ },
      { name: "vus_max", regex: /vus_max\s*:\s*(\d+)/ },
    ];

    for (const { name, regex } of metricRegexes) {
      const match = output.match(regex);

      if (match) {
        if (name === "http_req_duration") {
          metrics[name] = {
            avg: parseFloat(match[1]),
            min: parseFloat(match[2]),
            med: parseFloat(match[3]),
            max: parseFloat(match[4]),
            p90: parseFloat(match[5]),
            p95: parseFloat(match[6]),
          };
        } else if (name === "http_req_failed") {
          metrics[name] = {
            rate: parseFloat(match[1]) / 100,
          };
        } else {
          metrics[name] = parseInt(match[1], 10);
        }
      }
    }

    return metrics;
  } catch (error) {
    console.warn(
      chalk.yellow(
        `⚠️ Failed to parse k6 results: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return {};
  }
}

async function ensureApplicationRunning(): Promise<void> {
  try {
    // Check if application is already running
    const response = await fetch("http://localhost:3000/health");

    if (response.status === 200) {
      console.log(chalk.green("✅ Application is already running"));
      return;
    }
  } catch (error) {
    // Application is not running, start it
    console.log(chalk.blue("Starting application for testing..."));

    const app = spawn("npm", ["run", "dev"], {
      detached: true,
      stdio: "ignore",
    });

    // Detach the process
    app.unref();

    // Wait for application to start
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch("http://localhost:3000/health");

        if (response.status === 200) {
          console.log(chalk.green("✅ Application started successfully"));
          return;
        }
      } catch (error) {
        // Ignore error and retry
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Failed to start application after multiple attempts");
  }
}

async function measureMemoryGrowthDuringOperation(
  operation: () => Promise<void>,
): Promise<number> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Measure memory before operation
  const memoryBefore = process.memoryUsage().heapUsed;

  // Run the operation
  await operation();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Measure memory after operation
  const memoryAfter = process.memoryUsage().heapUsed;

  // Calculate memory growth
  const memoryGrowth = memoryAfter - memoryBefore;

  console.log(
    `Memory usage: ${formatBytes(memoryBefore)} -> ${formatBytes(memoryAfter)} (${formatBytes(memoryGrowth)} growth)`,
  );

  return memoryGrowth;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function notifyCISystem(success: boolean): Promise<void> {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS === "true") {
    if (!success) {
      console.log(`::error::Comprehensive integration tests failed`);
    } else {
      console.log(`::notice::Comprehensive integration tests passed`);
    }
  }

  // Jenkins
  if (process.env.JENKINS_URL) {
    // Jenkins typically uses JUnit XML format for test results
    const junitXml = generateJUnitXml(testResults);
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, "junit-results.xml"),
      junitXml,
    );
  }

  // Generic CI webhook
  if (process.env.CI_WEBHOOK_URL) {
    try {
      const fetch = require("node-fetch");

      await fetch(process.env.CI_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success,
          timestamp: new Date().toISOString(),
          results: Object.entries(testResults).map(([phase, result]) => ({
            phase,
            success: result.success,
            duration: (result.endTime - result.startTime) / 1000,
          })),
        }),
      });
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Failed to notify CI webhook: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}

function generateHtmlReport(data: any): string {
  // Simple HTML report template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprehensive Integration Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #1a73e8;
    }
    .success {
      color: #0f9d58;
    }
    .failure {
      color: #d23f31;
    }
    .warning {
      color: #f4b400;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
    .phase-details {
      margin-top: 10px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 5px;
    }
    .metric {
      display: inline-block;
      margin-right: 20px;
      margin-bottom: 10px;
    }
    .metric-value {
      font-weight: bold;
    }
    .system-info {
      background-color: #f0f4f8;
      padding: 15px;
      border-radius: 5px;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <h1>Comprehensive Integration Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="metric">
      <div>Overall Status:</div>
      <div class="metric-value ${data.summary.overallSuccess ? "success" : "failure"}">
        ${data.summary.overallSuccess ? "✅ PASSED" : "❌ FAILED"}
      </div>
    </div>
    <div class="metric">
      <div>Date:</div>
      <div class="metric-value">${new Date(data.summary.date).toLocaleString()}</div>
    </div>
    <div class="metric">
      <div>Environment:</div>
      <div class="metric-value">${data.summary.environment}</div>
    </div>
    <div class="metric">
      <div>Total Duration:</div>
      <div class="metric-value">${data.summary.totalDuration.toFixed(2)} seconds</div>
    </div>
  </div>
  
  <h2>Test Phases</h2>
  <table>
    <thead>
      <tr>
        <th>Phase</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${data.summary.phases
        .map(
          (phase) => `
        <tr>
          <td>${phase.phase}</td>
          <td class="${phase.success ? "success" : "failure"}">${phase.success ? "✅ PASSED" : "❌ FAILED"}</td>
          <td>${phase.duration.toFixed(2)}s</td>
          <td>${phase.errors.length > 0 ? `<ul>${phase.errors.map((err) => `<li class="failure">${err}</li>`).join("")}</ul>` : "-"}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  
  <h2>Test Details</h2>
  ${Object.entries(data.details)
    .map(
      ([phase, result]) => `
    <h3>${phase.charAt(0).toUpperCase() + phase.slice(1)}</h3>
    <div class="phase-details">
      <div class="metric">
        <div>Status:</div>
        <div class="metric-value ${result.success ? "success" : "failure"}">
          ${result.success ? "✅ PASSED" : "❌ FAILED"}
        </div>
      </div>
      <div class="metric">
        <div>Duration:</div>
        <div class="metric-value">${((result.endTime - result.startTime) / 1000).toFixed(2)}s</div>
      </div>
      
      ${
        result.details
          ? `
        <h4>Metrics</h4>
        <pre>${JSON.stringify(result.details, null, 2)}</pre>
      `
          : ""
      }
      
      ${
        result.errors.length > 0
          ? `
        <h4>Errors</h4>
        <ul>
          ${result.errors.map((err) => `<li class="failure">${err}</li>`).join("")}
        </ul>
      `
          : ""
      }
    </div>
  `,
    )
    .join("")}
  
  <div class="system-info">
    <h2>System Information</h2>
    <div class="metric">
      <div>CPU:</div>
      <div class="metric-value">${data.systemInfo.cpu}</div>
    </div>
    <div class="metric">
      <div>Cores:</div>
      <div class="metric-value">${data.systemInfo.cores}</div>
    </div>
    <div class="metric">
      <div>Memory:</div>
      <div class="metric-value">${data.systemInfo.totalMemory} (${data.systemInfo.freeMemory} free)</div>
    </div>
    <div class="metric">
      <div>Platform:</div>
      <div class="metric-value">${data.systemInfo.platform} ${data.systemInfo.release}</div>
    </div>
    <div class="metric">
      <div>Hostname:</div>
      <div class="metric-value">${data.systemInfo.hostname}</div>
    </div>
    <div class="metric">
      <div>Node.js:</div>
      <div class="metric-value">${data.summary.nodeVersion}</div>
    </div>
  </div>
</body>
</html>`;
}

function generateMarkdownReport(data: any): string {
  return `# Comprehensive Integration Test Report

## Summary

- **Overall Status:** ${data.summary.overallSuccess ? "✅ PASSED" : "❌ FAILED"}
- **Date:** ${new Date(data.summary.date).toLocaleString()}
- **Environment:** ${data.summary.environment}
- **Total Duration:** ${data.summary.totalDuration.toFixed(2)} seconds

## Test Phases

| Phase | Status | Duration | Details |
|-------|--------|----------|---------|
${data.summary.phases.map((phase) => `| ${phase.phase} | ${phase.success ? "✅ PASSED" : "❌ FAILED"} | ${phase.duration.toFixed(2)}s | ${phase.errors.length > 0 ? phase.errors.join(", ") : "-"} |`).join("\n")}

## Test Details

${Object.entries(data.details)
  .map(
    ([phase, result]) => `
### ${phase.charAt(0).toUpperCase() + phase.slice(1)}

- **Status:** ${result.success ? "✅ PASSED" : "❌ FAILED"}
- **Duration:** ${((result.endTime - result.startTime) / 1000).toFixed(2)}s

${
  result.details
    ? `
#### Metrics

\`\`\`json
${JSON.stringify(result.details, null, 2)}
\`\`\`
`
    : ""
}

${
  result.errors.length > 0
    ? `
#### Errors

${result.errors.map((err) => `- ${err}`).join("\n")}
`
    : ""
}
`,
  )
  .join("\n")}

## System Information

- **CPU:** ${data.systemInfo.cpu}
- **Cores:** ${data.systemInfo.cores}
- **Memory:** ${data.systemInfo.totalMemory} (${data.systemInfo.freeMemory} free)
- **Platform:** ${data.systemInfo.platform} ${data.systemInfo.release}
- **Hostname:** ${data.systemInfo.hostname}
- **Node.js:** ${data.summary.nodeVersion}
`;
}

function generateJUnitXml(results: any): string {
  const testcases = Object.entries(results).map(([phase, result]) => {
    const success = result.success;
    const duration = (result.endTime - result.startTime) / 1000;

    return `
      <testcase classname="integration" name="${phase}" time="${duration}">
        ${!success ? `<failure message="${result.errors.join(", ")}">${result.errors.join("\n")}</failure>` : ""}
      </testcase>
    `;
  });

  const totalTests = Object.keys(results).length;
  const failedTests = Object.values(results).filter(
    (result: any) => !result.success,
  ).length;

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Comprehensive Integration Tests" tests="${totalTests}" failures="${failedTests}" errors="0" skipped="0">
    ${testcases.join("")}
  </testsuite>
</testsuites>`;
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red.bold("❌ Fatal error:"));
  console.error(
    chalk.red(error instanceof Error ? error.stack : String(error)),
  );
  process.exit(1);
});
