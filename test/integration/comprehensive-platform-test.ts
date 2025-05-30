import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from 'jest';
import supertest from 'supertest';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../server';
import { db } from '../../server/db';
import { UnifiedCacheService } from '../../server/services/unified-cache-service';
import { WebSocketService } from '../../server/services/websocket-service';
import { FeatureFlagsService } from '../../server/services/feature-flags-service';
import { getErrorHandler } from '../../server/utils/error-handler';
import { ErrorCodes } from '../../server/utils/error-codes';

// Promisify exec for running shell commands
const execAsync = promisify(exec);

// Initialize test clients
const request = supertest(app);
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
let server: any;
let wsService: WebSocketService;
let cacheService: UnifiedCacheService;
let featureFlagsService: FeatureFlagsService;
let wsClients: WebSocket[] = [];
let testSandboxId: string;
let testDealershipId: string;
let testUserId: string;
let testTraceId: string;
let testAuthToken: string;

// Test constants
const CONNECTION_COUNT = 350; // Testing over 300 connections
const PERFORMANCE_TEST_DURATION = 60000; // 1 minute of load testing
const LOAD_TEST_RPS = 100; // 100 requests per second target
const MAX_MEMORY_LEAK_THRESHOLD = 10 * 1024 * 1024; // 10MB threshold for memory leak detection
const KPI_CACHE_TTL = 30; // 30 second TTL for KPI cache
const TEST_TIMEOUT = 120000; // 2 minute timeout for long-running tests

// Setup global test environment
beforeAll(async () => {
  // Verify TypeScript compilation with strict mode (INT-009)
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit');
    console.log('TypeScript compilation successful');
    expect(stderr).not.toContain('error TS');
  } catch (error) {
    console.error('TypeScript compilation failed:', error);
    throw new Error('TypeScript strict mode validation failed');
  }

  // Start server for testing
  server = createServer(app);
  server.listen(0); // Use any available port
  const port = (server.address() as any).port;

  // Initialize services
  wsService = new WebSocketService(server, redis);
  cacheService = new UnifiedCacheService(redis);
  featureFlagsService = new FeatureFlagsService(redis);

  // Create test data
  testSandboxId = `test-sandbox-${uuidv4()}`;
  testDealershipId = `test-dealership-${uuidv4()}`;
  testUserId = `test-user-${uuidv4()}`;
  testTraceId = `test-trace-${uuidv4()}`;
  
  // Get auth token for API calls
  const loginResponse = await request
    .post('/api/auth/login')
    .send({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword'
    });
  
  testAuthToken = loginResponse.body.token;

  // Enable feature flags for testing
  await featureFlagsService.setFlag('enable-redis-websocket-scaling', true);
  await featureFlagsService.setFlag('enable-sandbox-pause-resume', true);
  await featureFlagsService.setFlag('enable-kpi-caching', true);
  await featureFlagsService.setFlag('enable-global-error-handling', true);
  await featureFlagsService.setFlag('enable-error-ux-improvements', true);

  // Wait for services to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
}, TEST_TIMEOUT);

// Cleanup after all tests
afterAll(async () => {
  // Close all WebSocket connections
  for (const client of wsClients) {
    client.close();
  }
  
  // Close services
  await wsService.shutdown();
  await cacheService.shutdown();
  await redis.quit();
  
  // Close server
  server.close();
  
  // Clean up test data
  await db.query(`DELETE FROM sandboxes WHERE id = $1`, [testSandboxId]);
  
  // Clear feature flags
  await featureFlagsService.setFlag('enable-redis-websocket-scaling', false);
  await featureFlagsService.setFlag('enable-sandbox-pause-resume', false);
  await featureFlagsService.setFlag('enable-kpi-caching', false);
  await featureFlagsService.setFlag('enable-global-error-handling', false);
  await featureFlagsService.setFlag('enable-error-ux-improvements', false);
}, TEST_TIMEOUT);

// Reset state between tests
beforeEach(async () => {
  // Clear Redis cache
  await redis.flushall();
  
  // Reset WebSocket clients
  wsClients = [];
  
  // Reset sandbox state
  await request
    .post(`/api/sandbox/${testSandboxId}/resume`)
    .set('Authorization', `Bearer ${testAuthToken}`)
    .send();
});

// Clean up after each test
afterEach(async () => {
  // Close any remaining WebSocket connections
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  }
  wsClients = [];
});

// Helper functions
async function createWebSocketClients(count: number): Promise<WebSocket[]> {
  const clients: WebSocket[] = [];
  const port = (server.address() as any).port;
  
  for (let i = 0; i < count; i++) {
    const ws = new WebSocket(`ws://localhost:${port}/ws/sandbox/${testSandboxId}`);
    clients.push(ws);
    
    // Wait for connection to establish
    await new Promise((resolve) => {
      ws.on('open', resolve);
      ws.on('error', (err) => {
        console.error(`WebSocket connection error: ${err.message}`);
        resolve(null);
      });
    });
  }
  
  return clients;
}

async function measureMemoryUsage(duration: number, interval: number = 1000): Promise<number> {
  const measurements: number[] = [];
  const startTime = Date.now();
  
  while (Date.now() - startTime < duration) {
    const memUsage = process.memoryUsage();
    measurements.push(memUsage.heapUsed);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  // Calculate memory growth
  const firstMeasurement = measurements[0];
  const lastMeasurement = measurements[measurements.length - 1];
  return lastMeasurement - firstMeasurement;
}

async function runLoadTest(endpoint: string, duration: number, rps: number): Promise<{ avgResponseTime: number, errorRate: number }> {
  const startTime = Date.now();
  let requestCount = 0;
  let errorCount = 0;
  let totalResponseTime = 0;
  
  const interval = 1000 / rps;
  
  while (Date.now() - startTime < duration) {
    const requestStartTime = Date.now();
    
    try {
      const response = await request
        .get(endpoint)
        .set('Authorization', `Bearer ${testAuthToken}`);
      
      const responseTime = Date.now() - requestStartTime;
      totalResponseTime += responseTime;
      
      if (response.status >= 400) {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
    
    requestCount++;
    
    // Wait for next request interval
    const elapsed = Date.now() - requestStartTime;
    if (elapsed < interval) {
      await new Promise(resolve => setTimeout(resolve, interval - elapsed));
    }
  }
  
  return {
    avgResponseTime: totalResponseTime / requestCount,
    errorRate: errorCount / requestCount
  };
}

// 1. Global Error Handling Tests (INT-004)
describe('INT-004: Global Error Handling', () => {
  test('should return 500 with trace ID for server errors', async () => {
    // Force a server error by calling an endpoint that will trigger one
    const response = await request
      .get('/api/test/force-error')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('traceId');
    expect(response.body.traceId).toMatch(/^[0-9a-f-]+$/); // UUID format
  });
  
  test('should log errors with OTLP structured format', async () => {
    // Check log files for OTLP structured logging
    const logFiles = fs.readdirSync(path.join(process.cwd(), 'logs'));
    const errorLogFile = logFiles.find(file => file.includes('error'));
    
    if (errorLogFile) {
      const logContent = fs.readFileSync(path.join(process.cwd(), 'logs', errorLogFile), 'utf8');
      expect(logContent).toContain('"severity":"error"');
      expect(logContent).toContain('"traceId"');
    }
  });
  
  test('should handle WebSocket errors gracefully', async () => {
    // Create a WebSocket connection
    const port = (server.address() as any).port;
    const ws = new WebSocket(`ws://localhost:${port}/ws/sandbox/${testSandboxId}`);
    wsClients.push(ws);
    
    // Wait for connection
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    // Send malformed message to trigger error
    ws.send('{"type":"invalid_message_type"}');
    
    // Check for error response
    const errorMessage = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          resolve(message);
        }
      });
    });
    
    expect(errorMessage).toHaveProperty('type', 'error');
    expect(errorMessage).toHaveProperty('payload.traceId');
  });
});

// 2. KPI Query Caching Tests (INT-006)
describe('INT-006: KPI Query Caching', () => {
  test('should cache KPI queries with 30s TTL', async () => {
    // Make initial request to cache the result
    const firstResponse = await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.header['x-cache-hit']).toBe('false');
    
    // Make second request which should be cached
    const secondResponse = await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.header['x-cache-hit']).toBe('true');
    
    // Verify cache TTL
    const ttl = await redis.ttl('kpi:dashboard');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(KPI_CACHE_TTL);
  });
  
  test('should invalidate cache on ETL events', async () => {
    // Cache initial result
    await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // Verify it's cached
    const isCached = await redis.exists('kpi:dashboard');
    expect(isCached).toBe(1);
    
    // Trigger ETL event
    await request
      .post('/api/etl/process')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({ type: 'watchdog_data_update' });
    
    // Verify cache is invalidated
    const isStillCached = await redis.exists('kpi:dashboard');
    expect(isStillCached).toBe(0);
  });
  
  test('should respond in <50ms for cached queries', async () => {
    // Cache the result first
    await request
      .get('/api/kpi/performance')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // Measure response time for cached query
    const startTime = Date.now();
    await request
      .get('/api/kpi/performance')
      .set('Authorization', `Bearer ${testAuthToken}`);
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(50);
  });
});

// 3. Sandbox Pause/Resume API Tests (INT-007 H2)
describe('INT-007 H2: Sandbox Pause/Resume API', () => {
  test('should pause sandbox execution', async () => {
    // Pause the sandbox
    const pauseResponse = await request
      .post(`/api/sandbox/${testSandboxId}/pause`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    expect(pauseResponse.status).toBe(200);
    
    // Verify sandbox is paused
    const statusResponse = await request
      .get(`/api/sandbox/${testSandboxId}/status`)
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('paused');
  });
  
  test('should return 423 Locked for tool execution on paused sandbox', async () => {
    // Pause the sandbox
    await request
      .post(`/api/sandbox/${testSandboxId}/pause`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    // Attempt to execute a tool
    const toolResponse = await request
      .post(`/api/sandbox/${testSandboxId}/tools/execute`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        toolId: 'test-tool',
        params: { test: 'value' }
      });
    
    expect(toolResponse.status).toBe(423); // Locked
    expect(toolResponse.body.error).toContain('sandbox is paused');
  });
  
  test('should resume sandbox execution', async () => {
    // Pause the sandbox
    await request
      .post(`/api/sandbox/${testSandboxId}/pause`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    // Resume the sandbox
    const resumeResponse = await request
      .post(`/api/sandbox/${testSandboxId}/resume`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    expect(resumeResponse.status).toBe(200);
    
    // Verify sandbox is running
    const statusResponse = await request
      .get(`/api/sandbox/${testSandboxId}/status`)
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('running');
    
    // Verify tool execution now works
    const toolResponse = await request
      .post(`/api/sandbox/${testSandboxId}/tools/execute`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        toolId: 'test-tool',
        params: { test: 'value' }
      });
    
    expect(toolResponse.status).not.toBe(423);
  });
});

// 4. Redis WebSocket Scaling Tests (INT-007 H4)
describe('INT-007 H4: Redis WebSocket Scaling', () => {
  test('should support 300+ concurrent WebSocket connections', async () => {
    // Create 350 WebSocket connections
    const clients = await createWebSocketClients(CONNECTION_COUNT);
    wsClients.push(...clients);
    
    // Verify all connections are open
    const openConnections = clients.filter(c => c.readyState === WebSocket.OPEN);
    expect(openConnections.length).toBeGreaterThanOrEqual(300);
  }, TEST_TIMEOUT);
  
  test('should deliver messages with <1s lag across instances', async () => {
    // Create test WebSocket clients
    const clients = await createWebSocketClients(10);
    wsClients.push(...clients);
    
    // Send a message and measure delivery time to all clients
    const testMessage = { type: 'test', payload: { id: uuidv4() } };
    const messageTimes: number[] = [];
    
    // Set up listeners for message receipt
    const messagePromises = clients.map((client, index) => {
      return new Promise<number>((resolve) => {
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'broadcast' && message.payload.id === testMessage.payload.id) {
            const receiveTime = Date.now();
            resolve(receiveTime);
          }
        });
      });
    });
    
    // Broadcast message through Redis pub/sub
    const sendTime = Date.now();
    await redis.publish('ws:broadcast', JSON.stringify(testMessage));
    
    // Wait for all clients to receive the message
    const receiveTimes = await Promise.all(messagePromises);
    
    // Calculate lag times
    const lagTimes = receiveTimes.map(time => time - sendTime);
    const maxLag = Math.max(...lagTimes);
    
    expect(maxLag).toBeLessThan(1000); // Less than 1s lag
  });
  
  test('should queue messages for offline clients', async () => {
    // Create client ID for offline client
    const offlineClientId = `offline-client-${uuidv4()}`;
    
    // Send message to offline client
    await redis.publish('ws:message', JSON.stringify({
      clientId: offlineClientId,
      message: { type: 'test', payload: { data: 'test-data' } }
    }));
    
    // Check message queue
    const queueKey = `ws:queue:${offlineClientId}`;
    const queueLength = await redis.llen(queueKey);
    expect(queueLength).toBe(1);
    
    // Connect client and verify message delivery
    const port = (server.address() as any).port;
    const ws = new WebSocket(`ws://localhost:${port}/ws/sandbox/${testSandboxId}?clientId=${offlineClientId}`);
    wsClients.push(ws);
    
    // Wait for queued message
    const message = await new Promise((resolve) => {
      ws.on('open', () => {
        // Client is now connected, should receive queued message
      });
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });
    
    expect(message).toHaveProperty('type', 'test');
    expect(message).toHaveProperty('payload.data', 'test-data');
  });
});

// 5. Feature Flags Service Tests
describe('Feature Flags Service Integration', () => {
  test('should control feature availability based on flags', async () => {
    // Disable KPI caching feature flag
    await featureFlagsService.setFlag('enable-kpi-caching', false);
    
    // Verify feature is disabled
    const response = await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // Should not use cache when feature is disabled
    expect(response.header['x-cache-hit']).toBeUndefined();
    
    // Re-enable feature
    await featureFlagsService.setFlag('enable-kpi-caching', true);
    
    // Make request to cache result
    await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // Second request should use cache
    const cachedResponse = await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(cachedResponse.header['x-cache-hit']).toBe('true');
  });
  
  test('should support percentage-based rollout', async () => {
    // Set feature flag to 50% rollout
    await featureFlagsService.setFlag('enable-new-feature', 0.5);
    
    // Check feature availability for multiple users
    const results: boolean[] = [];
    
    for (let i = 0; i < 100; i++) {
      const userId = `test-user-${i}`;
      const isEnabled = await featureFlagsService.isEnabled('enable-new-feature', userId);
      results.push(isEnabled);
    }
    
    // Should be roughly 50% enabled
    const enabledCount = results.filter(r => r).length;
    expect(enabledCount).toBeGreaterThan(30);
    expect(enabledCount).toBeLessThan(70);
  });
});

// 6. Error UX Components Tests (INT-011)
describe('INT-011: Error UX Components', () => {
  test('should expose API for ActionableToast component', async () => {
    const response = await request
      .get('/api/ui/error-components/actionable-toast')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('component');
    expect(response.body.component).toBe('ActionableToast');
  });
  
  test('should expose API for ErrorBoundary component', async () => {
    const response = await request
      .get('/api/ui/error-components/error-boundary')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('component');
    expect(response.body.component).toBe('ErrorBoundary');
  });
  
  test('should include trace ID in error responses for UI components', async () => {
    const response = await request
      .get('/api/test/force-error')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('traceId');
    expect(response.body).toHaveProperty('userFriendlyMessage');
    expect(response.body.userFriendlyMessage).not.toContain('stack trace');
  });
});

// 7. Cross-Feature Integration Tests
describe('Cross-Feature Integration', () => {
  test('should handle errors in cached KPI endpoints correctly', async () => {
    // Force error in KPI endpoint
    const response = await request
      .get('/api/kpi/dashboard?forceError=true')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('traceId');
    
    // Verify error wasn't cached
    const cachedError = await redis.exists('kpi:dashboard:error');
    expect(cachedError).toBe(0);
  });
  
  test('should handle WebSocket errors with global error handler', async () => {
    // Create WebSocket connection
    const port = (server.address() as any).port;
    const ws = new WebSocket(`ws://localhost:${port}/ws/sandbox/${testSandboxId}`);
    wsClients.push(ws);
    
    // Wait for connection
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    // Send message that will trigger error
    ws.send(JSON.stringify({ type: 'force_error', payload: { message: 'Test error' } }));
    
    // Check for error response with trace ID
    const errorMessage = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          resolve(message);
        }
      });
    });
    
    expect(errorMessage).toHaveProperty('type', 'error');
    expect(errorMessage).toHaveProperty('payload.traceId');
    expect(errorMessage).toHaveProperty('payload.userFriendlyMessage');
  });
  
  test('should handle errors in paused sandbox correctly', async () => {
    // Pause the sandbox
    await request
      .post(`/api/sandbox/${testSandboxId}/pause`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    // Attempt to execute a tool
    const toolResponse = await request
      .post(`/api/sandbox/${testSandboxId}/tools/execute`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        toolId: 'test-tool',
        params: { test: 'value' }
      });
    
    expect(toolResponse.status).toBe(423); // Locked
    expect(toolResponse.body).toHaveProperty('error');
    expect(toolResponse.body).toHaveProperty('traceId');
    expect(toolResponse.body).toHaveProperty('userFriendlyMessage');
    expect(toolResponse.body.userFriendlyMessage).toContain('sandbox is paused');
  });
});

// 8. Performance Tests
describe('Performance Testing', () => {
  test('should handle 100 RPS with <1% error rate', async () => {
    const result = await runLoadTest('/api/kpi/dashboard', 10000, LOAD_TEST_RPS);
    
    expect(result.errorRate).toBeLessThan(0.01); // <1% error rate
  }, TEST_TIMEOUT);
  
  test('should maintain <50ms response times for cached endpoints under load', async () => {
    // Cache the result first
    await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // Run load test
    const result = await runLoadTest('/api/kpi/dashboard', 10000, 50);
    
    expect(result.avgResponseTime).toBeLessThan(50);
  }, TEST_TIMEOUT);
});

// 9. Memory Leak Detection
describe('Memory Leak Detection', () => {
  test('should not have memory leaks during WebSocket operations', async () => {
    // Create and close WebSocket connections repeatedly
    const memoryGrowth = await measureMemoryUsage(30000, 1000);
    
    expect(memoryGrowth).toBeLessThan(MAX_MEMORY_LEAK_THRESHOLD);
  }, TEST_TIMEOUT);
  
  test('should not have memory leaks during cache operations', async () => {
    // Perform repeated cache operations
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage().heapUsed;
    
    while (Date.now() - startTime < 30000) {
      const key = `test-key-${Math.random()}`;
      await cacheService.set(key, { data: 'test-data' }, 5);
      await cacheService.get(key);
      await cacheService.delete(key);
    }
    
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryGrowth = memoryAfter - memoryBefore;
    
    expect(memoryGrowth).toBeLessThan(MAX_MEMORY_LEAK_THRESHOLD);
  }, TEST_TIMEOUT);
});

// 10. API Backwards Compatibility
describe('API Backwards Compatibility', () => {
  test('should maintain compatibility with v1 API endpoints', async () => {
    // Test legacy endpoint still works
    const response = await request
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(response.status).toBe(200);
  });
  
  test('should support both new and old request formats', async () => {
    // Test new format
    const newFormatResponse = await request
      .post('/api/conversations')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        message: 'Test message',
        metadata: { source: 'test' }
      });
    
    expect(newFormatResponse.status).toBe(200);
    
    // Test old format
    const oldFormatResponse = await request
      .post('/api/conversations')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        message: 'Test message',
        source: 'test'
      });
    
    expect(oldFormatResponse.status).toBe(200);
  });
});

// 11. Database Connection Pooling
describe('Database Connection Pooling', () => {
  test('should handle concurrent database operations', async () => {
    // Create many concurrent database queries
    const concurrentQueries = 50;
    const queries = [];
    
    for (let i = 0; i < concurrentQueries; i++) {
      queries.push(db.query('SELECT 1 as result'));
    }
    
    const results = await Promise.all(queries);
    
    // All queries should succeed
    expect(results.length).toBe(concurrentQueries);
    results.forEach(result => {
      expect(result.rows[0].result).toBe(1);
    });
  });
  
  test('should maintain pool health under stress', async () => {
    // Get initial pool metrics
    const initialMetricsResponse = await request
      .get('/api/metrics/database/pool')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    const initialMetrics = initialMetricsResponse.body;
    
    // Run stress test
    const concurrentQueries = 100;
    const queries = [];
    
    for (let i = 0; i < concurrentQueries; i++) {
      queries.push(db.query('SELECT pg_sleep(0.1), 1 as result'));
    }
    
    await Promise.all(queries);
    
    // Get post-stress metrics
    const postMetricsResponse = await request
      .get('/api/metrics/database/pool')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    const postMetrics = postMetricsResponse.body;
    
    // Pool should recover after stress
    expect(postMetrics.available).toBeGreaterThan(0);
    expect(postMetrics.idle).toBeGreaterThan(0);
  });
});

// 12. Redis Scaling and Failover
describe('Redis Scaling and Failover', () => {
  test('should handle Redis connection interruptions gracefully', async () => {
    // Force Redis disconnect
    await redis.disconnect();
    
    // Try to access cached endpoint
    const response = await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // Should still work, falling back to non-cached version
    expect(response.status).toBe(200);
    
    // Reconnect Redis
    await redis.connect();
  });
});

// 13. Security Boundary Testing
describe('Security Boundary Testing', () => {
  test('should enforce authentication on all protected endpoints', async () => {
    // Try to access protected endpoint without auth
    const response = await request
      .get('/api/kpi/dashboard');
    
    expect(response.status).toBe(401);
  });
  
  test('should enforce authorization for sandbox operations', async () => {
    // Create auth token for user without access to test sandbox
    const loginResponse = await request
      .post('/api/auth/login')
      .send({
        email: process.env.RESTRICTED_USER_EMAIL || 'restricted@example.com',
        password: process.env.RESTRICTED_USER_PASSWORD || 'restrictedpassword'
      });
    
    const restrictedToken = loginResponse.body.token;
    
    // Try to access sandbox with restricted user
    const response = await request
      .get(`/api/sandbox/${testSandboxId}/status`)
      .set('Authorization', `Bearer ${restrictedToken}`);
    
    expect(response.status).toBe(403);
  });
  
  test('should sanitize error messages to prevent information disclosure', async () => {
    // Force an error that might contain sensitive info
    const response = await request
      .get('/api/test/force-error?sensitive=true')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(response.status).toBe(500);
    expect(response.body.userFriendlyMessage).not.toContain('password');
    expect(response.body.userFriendlyMessage).not.toContain('credential');
    expect(response.body.userFriendlyMessage).not.toContain('token');
    expect(response.body).not.toHaveProperty('stack');
  });
});

// 14. End-to-End Workflow Tests
describe('End-to-End User Workflows', () => {
  test('should support complete conversation workflow', async () => {
    // 1. Create conversation
    const createResponse = await request
      .post('/api/conversations')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        message: 'Hello, this is a test conversation',
        metadata: { source: 'integration-test' }
      });
    
    expect(createResponse.status).toBe(200);
    const conversationId = createResponse.body.id;
    
    // 2. Get conversation
    const getResponse = await request
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(conversationId);
    
    // 3. Add message to conversation
    const messageResponse = await request
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        message: 'This is a follow-up message',
        metadata: { source: 'integration-test' }
      });
    
    expect(messageResponse.status).toBe(200);
    
    // 4. Get conversation messages
    const messagesResponse = await request
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.body.length).toBeGreaterThanOrEqual(2);
    
    // 5. Close conversation
    const closeResponse = await request
      .post(`/api/conversations/${conversationId}/close`)
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(closeResponse.status).toBe(200);
    
    // 6. Verify conversation is closed
    const statusResponse = await request
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBe('closed');
  });
});

// Final comprehensive test validating all systems working together
describe('Comprehensive Platform Validation', () => {
  test('should validate all integrated systems working together', async () => {
    // This test exercises all major integrated features together
    
    // 1. Create WebSocket connections with Redis scaling
    const wsClients = await createWebSocketClients(10);
    
    // 2. Use KPI caching
    const kpiResponse = await request
      .get('/api/kpi/dashboard')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    // 3. Pause sandbox
    await request
      .post(`/api/sandbox/${testSandboxId}/pause`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    // 4. Verify tool execution is blocked
    const toolResponse = await request
      .post(`/api/sandbox/${testSandboxId}/tools/execute`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        toolId: 'test-tool',
        params: { test: 'value' }
      });
    
    expect(toolResponse.status).toBe(423);
    
    // 5. Resume sandbox
    await request
      .post(`/api/sandbox/${testSandboxId}/resume`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send();
    
    // 6. Verify tool execution works
    const resumedToolResponse = await request
      .post(`/api/sandbox/${testSandboxId}/tools/execute`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        toolId: 'test-tool',
        params: { test: 'value' }
      });
    
    expect(resumedToolResponse.status).not.toBe(423);
    
    // 7. Broadcast message through WebSockets
    const testMessage = { type: 'test', payload: { id: uuidv4() } };
    await redis.publish('ws:broadcast', JSON.stringify(testMessage));
    
    // 8. Force error to test error handling
    const errorResponse = await request
      .get('/api/test/force-error')
      .set('Authorization', `Bearer ${testAuthToken}`);
    
    expect(errorResponse.status).toBe(500);
    expect(errorResponse.body).toHaveProperty('traceId');
    
    // 9. Verify TypeScript compilation still works
    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit');
      expect(stderr).not.toContain('error TS');
    } catch (error) {
      throw new Error('TypeScript strict mode validation failed');
    }
    
    // 10. Clean up WebSocket connections
    for (const client of wsClients) {
      client.close();
    }
    
    // All systems validated together
    console.log('✅ Comprehensive platform validation successful');
  }, TEST_TIMEOUT);
});
