#!/usr/bin/env node

/**
 * Database Connection Pool Load Test
 * 
 * Tests the enhanced database connection pool (C3) under load:
 * - 100 requests per second for 3 minutes
 * - Multiple endpoints that use the database pool
 * - Monitors connection errors and pool statistics
 * - Validates error rate stays below 1%
 * 
 * Usage: node test/load/db-pool-load-test.js [--host=http://localhost:3000]
 */

// Native modules
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    acc[key] = value || true;
  }
  return acc;
}, {});

// Test configuration
const config = {
  host: args.host || 'http://localhost:3000',
  duration: 3 * 60, // 3 minutes in seconds
  requestsPerSecond: 100,
  concurrency: 20, // Maximum concurrent requests
  endpoints: [
    '/api/metrics/database/pool',
    '/api/database/performance',
    '/api/metrics/all',
    '/api/summary',
    '/api/health'
  ],
  poolStatsEndpoint: '/api/metrics/database/pool',
  maxErrorRate: 0.01, // 1%
};

// Test metrics
const metrics = {
  startTime: 0,
  endTime: 0,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimeTotal: 0,
  responseTimeMin: Number.MAX_SAFE_INTEGER,
  responseTimeMax: 0,
  responseTimeBuckets: {
    '<50ms': 0,
    '50-100ms': 0,
    '100-250ms': 0,
    '250-500ms': 0,
    '500-1000ms': 0,
    '>1000ms': 0
  },
  statusCodes: {},
  errors: {},
  poolStats: [],
  // Track the last 10 seconds of requests for RPS calculation
  recentRequests: [],
};

/**
 * Make a request to an endpoint and track metrics
 */
async function makeRequest(endpoint) {
  const startTime = performance.now();
  metrics.totalRequests++;
  
  try {
    const response = await fetch(`${config.host}${endpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    // Track response time metrics
    metrics.responseTimeTotal += responseTime;
    metrics.responseTimeMin = Math.min(metrics.responseTimeMin, responseTime);
    metrics.responseTimeMax = Math.max(metrics.responseTimeMax, responseTime);
    
    // Categorize response time
    if (responseTime < 50) metrics.responseTimeBuckets['<50ms']++;
    else if (responseTime < 100) metrics.responseTimeBuckets['50-100ms']++;
    else if (responseTime < 250) metrics.responseTimeBuckets['100-250ms']++;
    else if (responseTime < 500) metrics.responseTimeBuckets['250-500ms']++;
    else if (responseTime < 1000) metrics.responseTimeBuckets['500-1000ms']++;
    else metrics.responseTimeBuckets['>1000ms']++;
    
    // Track status codes
    const status = response.status;
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;
    
    if (status >= 200 && status < 400) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      const errorText = await response.text();
      const errorKey = `HTTP ${status}: ${errorText.slice(0, 100)}`;
      metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
    }
    
    // Track for RPS calculation
    metrics.recentRequests.push(Date.now());
    
    // Clean up old requests from recentRequests (older than 10 seconds)
    const tenSecondsAgo = Date.now() - 10000;
    while (metrics.recentRequests.length > 0 && metrics.recentRequests[0] < tenSecondsAgo) {
      metrics.recentRequests.shift();
    }
    
    return response;
  } catch (error) {
    metrics.failedRequests++;
    const errorKey = error.name + ': ' + error.message;
    metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
    
    // Track for RPS calculation
    metrics.recentRequests.push(Date.now());
    
    // Clean up old requests from recentRequests
    const tenSecondsAgo = Date.now() - 10000;
    while (metrics.recentRequests.length > 0 && metrics.recentRequests[0] < tenSecondsAgo) {
      metrics.recentRequests.shift();
    }
    
    return null;
  }
}

/**
 * Fetch and store database pool statistics
 */
async function fetchPoolStats() {
  try {
    const response = await fetch(`${config.host}${config.poolStatsEndpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      metrics.poolStats.push({
        timestamp: Date.now(),
        active: data.data.active || 0,
        idle: data.data.idle || 0,
        max: data.data.max || 20,
        waiting: data.data.waiting || 0,
        status: data.data.status || 'unknown'
      });
    }
  } catch (error) {
    console.error('Failed to fetch pool stats:', error.message);
  }
}

/**
 * Print progress during the test
 */
function printProgress(elapsedSeconds, totalSeconds) {
  const percent = Math.round((elapsedSeconds / totalSeconds) * 100);
  const currentRps = metrics.recentRequests.length / 10;
  const successRate = metrics.totalRequests > 0 
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : '0.00';
  
  // Get the latest pool stats
  const latestStats = metrics.poolStats.length > 0 
    ? metrics.poolStats[metrics.poolStats.length - 1] 
    : { active: 0, idle: 0, max: 20, waiting: 0 };
  
  process.stdout.write(`\r[${percent}%] ${elapsedSeconds}/${totalSeconds}s | ` +
    `RPS: ${currentRps.toFixed(1)} | ` +
    `Success: ${successRate}% | ` +
    `Pool: ${latestStats.active}/${latestStats.max} active, ` +
    `${latestStats.waiting} waiting`);
}

/**
 * Generate a detailed report of test results
 */
function generateReport() {
  const durationMs = metrics.endTime - metrics.startTime;
  const durationSeconds = durationMs / 1000;
  const actualRps = metrics.totalRequests / durationSeconds;
  const avgResponseTime = metrics.totalRequests > 0 
    ? metrics.responseTimeTotal / metrics.totalRequests 
    : 0;
  const errorRate = metrics.totalRequests > 0 
    ? metrics.failedRequests / metrics.totalRequests 
    : 0;
  
  // Calculate pool statistics
  const maxActiveConnections = Math.max(...metrics.poolStats.map(stat => stat.active));
  const maxWaitingConnections = Math.max(...metrics.poolStats.map(stat => stat.waiting));
  const avgActiveConnections = metrics.poolStats.reduce((sum, stat) => sum + stat.active, 0) / metrics.poolStats.length;
  
  console.log('\n\n========================================');
  console.log('DATABASE POOL LOAD TEST RESULTS');
  console.log('========================================');
  console.log(`Duration: ${durationSeconds.toFixed(2)} seconds`);
  console.log(`Target RPS: ${config.requestsPerSecond}`);
  console.log(`Actual RPS: ${actualRps.toFixed(2)}`);
  console.log(`Total Requests: ${metrics.totalRequests}`);
  console.log(`Successful Requests: ${metrics.successfulRequests}`);
  console.log(`Failed Requests: ${metrics.failedRequests}`);
  console.log(`Error Rate: ${(errorRate * 100).toFixed(2)}%`);
  console.log(`Success Rate: ${((1 - errorRate) * 100).toFixed(2)}%`);
  console.log('\nResponse Time:');
  console.log(`  Average: ${avgResponseTime.toFixed(2)} ms`);
  console.log(`  Min: ${metrics.responseTimeMin.toFixed(2)} ms`);
  console.log(`  Max: ${metrics.responseTimeMax.toFixed(2)} ms`);
  
  console.log('\nResponse Time Distribution:');
  for (const [bucket, count] of Object.entries(metrics.responseTimeBuckets)) {
    const percentage = metrics.totalRequests > 0 
      ? (count / metrics.totalRequests * 100).toFixed(2) 
      : '0.00';
    console.log(`  ${bucket}: ${count} (${percentage}%)`);
  }
  
  console.log('\nStatus Codes:');
  for (const [code, count] of Object.entries(metrics.statusCodes)) {
    const percentage = metrics.totalRequests > 0 
      ? (count / metrics.totalRequests * 100).toFixed(2) 
      : '0.00';
    console.log(`  ${code}: ${count} (${percentage}%)`);
  }
  
  if (Object.keys(metrics.errors).length > 0) {
    console.log('\nErrors:');
    for (const [error, count] of Object.entries(metrics.errors)) {
      const percentage = metrics.totalRequests > 0 
        ? (count / metrics.totalRequests * 100).toFixed(2) 
        : '0.00';
      console.log(`  ${error}: ${count} (${percentage}%)`);
    }
  }
  
  console.log('\nDatabase Pool Statistics:');
  console.log(`  Max Active Connections: ${maxActiveConnections}`);
  console.log(`  Average Active Connections: ${avgActiveConnections.toFixed(2)}`);
  console.log(`  Max Waiting Connections: ${maxWaitingConnections}`);
  console.log(`  Connection Pool Size: ${metrics.poolStats[0]?.max || 20}`);
  
  // Test result validation
  console.log('\nTest Validation:');
  const passedRps = Math.abs(actualRps - config.requestsPerSecond) < config.requestsPerSecond * 0.1;
  const passedErrorRate = errorRate <= config.maxErrorRate;
  const passedPoolUtilization = maxActiveConnections > 0;
  
  console.log(`  [${passedRps ? 'PASS' : 'FAIL'}] RPS within 10% of target`);
  console.log(`  [${passedErrorRate ? 'PASS' : 'FAIL'}] Error rate below ${config.maxErrorRate * 100}%`);
  console.log(`  [${passedPoolUtilization ? 'PASS' : 'FAIL'}] Pool utilization detected`);
  
  const overallResult = passedRps && passedErrorRate && passedPoolUtilization;
  console.log('\n========================================');
  console.log(`OVERALL RESULT: ${overallResult ? 'PASS' : 'FAIL'}`);
  console.log('========================================');
  
  return overallResult;
}

/**
 * Run the load test
 */
async function runLoadTest() {
  console.log('Starting Database Pool Load Test');
  console.log(`Host: ${config.host}`);
  console.log(`Duration: ${config.duration} seconds`);
  console.log(`Target RPS: ${config.requestsPerSecond}`);
  console.log(`Endpoints: ${config.endpoints.join(', ')}`);
  console.log('----------------------------------------');
  
  metrics.startTime = performance.now();
  let elapsedSeconds = 0;
  
  // Fetch initial pool stats
  await fetchPoolStats();
  
  // Start the test loop
  while (elapsedSeconds < config.duration) {
    const batchStartTime = performance.now();
    
    // Calculate how many requests to make this second to maintain the target RPS
    const requestsThisSecond = config.requestsPerSecond;
    const requestPromises = [];
    
    // Distribute requests across the second
    const intervalMs = 1000 / requestsThisSecond;
    
    for (let i = 0; i < requestsThisSecond; i++) {
      // Select a random endpoint from the list
      const endpoint = config.endpoints[Math.floor(Math.random() * config.endpoints.length)];
      
      // Delay each request to distribute load across the second
      const delay = i * intervalMs;
      
      // Add the request to our batch with the calculated delay
      requestPromises.push(
        sleep(delay).then(() => makeRequest(endpoint))
      );
    }
    
    // Wait for all requests in this batch to complete
    await Promise.allSettled(requestPromises);
    
    // Fetch pool stats every 5 seconds
    if (elapsedSeconds % 5 === 0) {
      await fetchPoolStats();
    }
    
    // Calculate how long this batch took
    const batchEndTime = performance.now();
    const batchDuration = batchEndTime - batchStartTime;
    
    // If we completed faster than 1 second, wait for the remainder
    if (batchDuration < 1000) {
      await sleep(1000 - batchDuration);
    }
    
    elapsedSeconds++;
    printProgress(elapsedSeconds, config.duration);
  }
  
  metrics.endTime = performance.now();
  
  // Fetch final pool stats
  await fetchPoolStats();
  
  // Generate and print the report
  const testPassed = generateReport();
  
  // Exit with appropriate code
  process.exit(testPassed ? 0 : 1);
}

// Run the load test
try {
  await runLoadTest();
} catch (error) {
  console.error('\n\nTest failed with error:', error);
  process.exit(1);
}
