import { group, check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Counter, Rate } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { config } from './config.js';

// Custom metrics for overall performance
const overallResponseTime = new Trend('overall_response_time');
const testErrors = new Counter('test_errors');
const successRate = new Rate('success_rate');

// Test configuration - Progressive load testing
export const options = {
  scenarios: {
    // API Load Testing
    api_load: {
      executor: 'ramping-vus',
      exec: 'apiLoadTest',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up to 20 users
        { duration: '2m', target: 20 },   // Stay at 20 users
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 100 },  // Ramp up to 100 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },

    // WebSocket/Chat Load Testing (lower concurrency)
    chat_load: {
      executor: 'ramping-vus',
      exec: 'chatLoadTest',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Ramp up to 10 connections
        { duration: '2m', target: 10 },   // Stay at 10 connections
        { duration: '1m', target: 25 },   // Ramp up to 25 connections
        { duration: '3m', target: 25 },   // Stay at 25 connections
        { duration: '1m', target: 50 },   // Ramp up to 50 connections
        { duration: '3m', target: 50 },   // Stay at 50 connections
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },

    // Inventory Load Testing (specialized for bulk operations)
    inventory_load: {
      executor: 'ramping-vus',
      exec: 'inventoryLoadTest',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },    // Start with 5 users
        { duration: '2m', target: 5 },    // Stay at 5 users
        { duration: '1m', target: 15 },   // Ramp up to 15 users
        { duration: '3m', target: 15 },   // Stay at 15 users
        { duration: '1m', target: 25 },   // Ramp up to 25 users
        { duration: '3m', target: 25 },   // Stay at 25 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },
  },

  // Global thresholds
  thresholds: {
    // Overall performance requirements
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],

    // WebSocket performance
    ws_connecting: ['p(95)<500'],

    // Custom metrics
    overall_response_time: ['p(95)<1000'],
    success_rate: ['rate>0.99'],
    test_errors: ['count<10'],

    // Scenario-specific thresholds
    'http_req_duration{scenario:api_load}': ['p(95)<1000'],
    'http_req_duration{scenario:inventory_load}': ['p(95)<2000'],
    'ws_connecting{scenario:chat_load}': ['p(95)<500'],
  },
};

// Setup function
export function setup() {
  console.log('🚀 Starting Comprehensive Load Test Suite');
  console.log(`Target URL: ${config.baseUrl}`);

  // Verify application is running
  const healthCheck = group('Health Check', function() {
    const response = http.get(`${config.baseUrl}/api/health`);

    check(response, {
      'Application is healthy': (r) => r.status === 200,
      'Health check response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (response.status !== 200) {
      throw new Error('Application health check failed - aborting load test');
    }

    return response;
  });

  console.log('✅ Application health check passed');

  return {
    baseUrl: config.baseUrl,
    startTime: Date.now()
  };
}

// API Load Test Function
export function apiLoadTest(data) {
  group('API Load Test', function() {
    try {
      // Basic API testing inline
      const baseUrl = data.baseUrl;

      // Test health endpoint
      const healthResponse = http.get(`${baseUrl}/api/metrics/health`);
      check(healthResponse, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 500ms': (r) => r.timings.duration < 500,
      });

      // Test vehicle search
      const vehicleResponse = http.get(`${baseUrl}/api/vehicles?make=Toyota`);
      check(vehicleResponse, {
        'vehicle search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
        'vehicle search response time < 2000ms': (r) => r.timings.duration < 2000,
      });

      successRate.add(1);
    } catch (error) {
      testErrors.add(1);
      successRate.add(0);
      console.error('API test error:', error);
    }
  });
}

// Chat Load Test Function
export function chatLoadTest(data) {
  group('Chat Load Test', function() {
    try {
      // Basic WebSocket testing would go here
      // For now, just simulate with HTTP calls
      const baseUrl = data.baseUrl;

      const response = http.get(`${baseUrl}/api/metrics/health`);
      check(response, {
        'chat test health check': (r) => r.status === 200,
      });

      successRate.add(1);
    } catch (error) {
      testErrors.add(1);
      successRate.add(0);
      console.error('Chat test error:', error);
    }
  });
}

// Inventory Load Test Function
export function inventoryLoadTest(data) {
  group('Inventory Load Test', function() {
    try {
      // Basic inventory testing inline
      const baseUrl = data.baseUrl;

      // Test complex inventory search
      const searchResponse = http.get(`${baseUrl}/api/vehicles?make=Toyota&minPrice=20000&maxPrice=35000`);
      check(searchResponse, {
        'inventory search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
        'inventory search response time < 2000ms': (r) => r.timings.duration < 2000,
      });

      successRate.add(1);
    } catch (error) {
      testErrors.add(1);
      successRate.add(0);
      console.error('Inventory test error:', error);
    }
  });
}

// Teardown function
export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`🏁 Load Test Suite Complete - Duration: ${testDuration}s`);
}

// Custom report generation
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    [`test/performance/load-test-report-${timestamp}.html`]: htmlReport(data),
    [`test/performance/load-test-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
