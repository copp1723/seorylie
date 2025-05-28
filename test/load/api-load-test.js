import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { config, getRandomDealership, getRandomUser, getRandomVehicle } from './config.js';

// Custom metrics
const apiResponseTime = new Trend('api_response_time');
const authTime = new Trend('auth_time');
const inventoryQueryTime = new Trend('inventory_query_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    api_response_time: ['p(95)<800'],
    auth_time: ['p(95)<500'],
    inventory_query_time: ['p(95)<1000'],
  },
};

// Setup function - runs once per VU
export function setup() {
  // Health check
  const healthResponse = http.get(`${config.baseUrl}/api/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  console.log('API Load Test Setup Complete');
  return { baseUrl: config.baseUrl };
}

// Main test function
export default function(data) {
  const baseUrl = data.baseUrl;
  let authToken = null;
  
  // Test 1: Authentication
  testAuthentication(baseUrl);
  
  // Test 2: Inventory endpoints
  testInventoryEndpoints(baseUrl);
  
  // Test 3: Admin endpoints (if authenticated)
  testAdminEndpoints(baseUrl);
  
  // Test 4: Monitoring endpoints
  testMonitoringEndpoints(baseUrl);
  
  sleep(1); // Think time between iterations
}

function testAuthentication(baseUrl) {
  const startTime = Date.now();
  const user = getRandomUser();
  
  // Test login
  const loginPayload = {
    username: user.username,
    password: user.password
  };
  
  const loginResponse = http.post(`${baseUrl}/api/login`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const authDuration = Date.now() - startTime;
  authTime.add(authDuration);
  
  check(loginResponse, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  // If login successful, extract session/token
  if (loginResponse.status === 200) {
    // Extract session cookie or token if needed
    const cookies = loginResponse.cookies;
    return cookies;
  }
  
  return null;
}

function testInventoryEndpoints(baseUrl) {
  const startTime = Date.now();
  
  // Test vehicle search with various parameters
  const searchParams = [
    '?make=Toyota',
    '?model=Camry',
    '?year=2023',
    '?minPrice=20000&maxPrice=30000',
    '?condition=new',
    '?search=reliable',
    '?sortBy=price&sortOrder=asc',
    '?page=1&limit=10'
  ];
  
  const randomParam = searchParams[Math.floor(Math.random() * searchParams.length)];
  const inventoryResponse = http.get(`${baseUrl}/api/vehicles${randomParam}`);
  
  const queryDuration = Date.now() - startTime;
  inventoryQueryTime.add(queryDuration);
  
  check(inventoryResponse, {
    'inventory search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'inventory search response time < 2000ms': (r) => r.timings.duration < 2000,
    'inventory response has vehicles array': (r) => {
      if (r.status === 200) {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.vehicles);
        } catch (e) {
          return false;
        }
      }
      return true; // Skip check if not authenticated
    },
  });
  
  // Test individual vehicle endpoint
  const vehicleId = Math.floor(Math.random() * 100) + 1;
  const vehicleResponse = http.get(`${baseUrl}/api/vehicles/${vehicleId}`);
  
  check(vehicleResponse, {
    'vehicle detail status is 200, 401, or 404': (r) => 
      r.status === 200 || r.status === 401 || r.status === 404,
    'vehicle detail response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

function testAdminEndpoints(baseUrl) {
  // Test admin endpoints (expect 401 for most users)
  const adminResponse = http.get(`${baseUrl}/api/admin/dealerships`);
  
  check(adminResponse, {
    'admin endpoint status is 401 or 200': (r) => r.status === 401 || r.status === 200,
    'admin endpoint response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  // Test dealership config endpoint
  const dealership = getRandomDealership();
  const configResponse = http.get(`${baseUrl}/api/admin/dealerships/${dealership.id}/config`);
  
  check(configResponse, {
    'dealership config status is 401 or 200 or 404': (r) => 
      r.status === 401 || r.status === 200 || r.status === 404,
    'dealership config response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

function testMonitoringEndpoints(baseUrl) {
  const startTime = Date.now();
  
  // Test health endpoint
  const healthResponse = http.get(`${baseUrl}/api/metrics/health`);
  
  check(healthResponse, {
    'health endpoint status is 200': (r) => r.status === 200,
    'health endpoint response time < 500ms': (r) => r.timings.duration < 500,
    'health response has status': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  // Test metrics endpoint
  const metricsResponse = http.get(`${baseUrl}/api/metrics`);
  
  check(metricsResponse, {
    'metrics endpoint status is 200': (r) => r.status === 200,
    'metrics endpoint response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  const apiDuration = Date.now() - startTime;
  apiResponseTime.add(apiDuration);
}

// Teardown function
export function teardown(data) {
  console.log('API Load Test Complete');
}
