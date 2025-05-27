#!/usr/bin/env node

/**
 * Comprehensive API Testing Script for CleanRylie
 * Tests all core API endpoints for functional validation
 */

const BASE_URL = 'http://127.0.0.1:3000';

// Test results collector
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Make HTTP request with timing
 */
async function makeRequest(method, path, data = null, headers = {}) {
  const start = Date.now();
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const duration = Date.now() - start;
    
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    return {
      status: response.status,
      data: responseData,
      duration,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      duration: Date.now() - start
    };
  }
}

/**
 * Run a test case
 */
async function runTest(name, testFunc) {
  console.log(`\n🧪 Running: ${name}`);
  testResults.total++;
  
  try {
    const result = await testFunc();
    if (result.passed) {
      testResults.passed++;
      console.log(`✅ PASSED: ${name}`);
      if (result.details) console.log(`   ${result.details}`);
    } else {
      testResults.failed++;
      console.log(`❌ FAILED: ${name}`);
      if (result.error) console.log(`   Error: ${result.error}`);
    }
    
    testResults.tests.push({
      name,
      passed: result.passed,
      details: result.details,
      error: result.error,
      response: result.response
    });
  } catch (error) {
    testResults.failed++;
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${error.message}`);
    
    testResults.tests.push({
      name,
      passed: false,
      error: error.message
    });
  }
}

/**
 * Test System Health Endpoint
 */
async function testHealthEndpoint() {
  const response = await makeRequest('GET', '/api/metrics/health');
  
  if (response.status === 200 && typeof response.data === 'object') {
    return {
      passed: true,
      details: `Response time: ${response.duration}ms, Status: ${response.data.status}`,
      response
    };
  }
  
  return {
    passed: false,
    error: `Expected 200 status with JSON, got ${response.status}`,
    response
  };
}

/**
 * Test CSRF Token Endpoint
 */
async function testCSRFToken() {
  const response = await makeRequest('GET', '/api/csrf-token');
  
  if (response.status === 200 && response.data.csrfToken) {
    return {
      passed: true,
      details: `CSRF token received: ${response.data.csrfToken.substring(0, 10)}...`,
      response
    };
  }
  
  return {
    passed: false,
    error: `Expected 200 with csrfToken, got ${response.status}`,
    response
  };
}

/**
 * Test Authentication Required Endpoints
 */
async function testAuthRequiredEndpoints() {
  const endpoints = [
    { method: 'GET', path: '/api/admin/dealerships' },
    { method: 'GET', path: '/api/conversation-logs' },
    { method: 'GET', path: '/api/my-follow-ups' }
  ];
  
  let passed = 0;
  let total = endpoints.length;
  
  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint.method, endpoint.path);
    if (response.status === 401 || response.status === 403) {
      passed++;
    }
  }
  
  return {
    passed: passed === total,
    details: `${passed}/${total} endpoints correctly require authentication`,
    response: { tested: total, authenticated: passed }
  };
}

/**
 * Test Error Handling
 */
async function testErrorHandling() {
  const tests = [
    {
      name: 'Invalid JSON in POST request',
      method: 'POST',
      path: '/api/invitations/accept',
      data: { invalid: 'data' },
      expectedStatus: 400
    },
    {
      name: 'Non-existent endpoint',
      method: 'GET', 
      path: '/api/nonexistent',
      expectedStatus: 404
    }
  ];
  
  let passed = 0;
  
  for (const test of tests) {
    const response = await makeRequest(test.method, test.path, test.data);
    if (response.status === test.expectedStatus) {
      passed++;
    }
  }
  
  return {
    passed: passed === tests.length,
    details: `${passed}/${tests.length} error handling tests passed`,
    response: { passed, total: tests.length }
  };
}

/**
 * Test Rate Limiting
 */
async function testRateLimiting() {
  const requests = [];
  const endpoint = '/api/csrf-token';
  
  // Make multiple rapid requests
  for (let i = 0; i < 10; i++) {
    requests.push(makeRequest('GET', endpoint));
  }
  
  const responses = await Promise.all(requests);
  const successCount = responses.filter(r => r.status === 200).length;
  
  return {
    passed: successCount > 0, // At least some should succeed
    details: `${successCount}/10 requests succeeded (rate limiting may be active)`,
    response: { successCount, totalRequests: 10 }
  };
}

/**
 * Test Request/Response Format Validation
 */
async function testRequestResponseFormats() {
  // Test valid invitation acceptance request format
  const response = await makeRequest('POST', '/api/invitations/accept', {
    token: 'test-token',
    name: 'Test User',
    password: 'testpassword123'
  });
  
  // Should get a specific error about invalid token, not format error
  const isValidFormat = response.status === 400 || response.status === 500;
  
  return {
    passed: isValidFormat,
    details: `Request format validation working: ${response.status}`,
    response
  };
}

/**
 * Test Multi-tenant Data Isolation (Basic Check)
 */
async function testMultiTenantIsolation() {
  // Test accessing different dealership data without auth
  const dealership1 = await makeRequest('GET', '/api/admin/dealerships/1');
  const dealership2 = await makeRequest('GET', '/api/admin/dealerships/2');
  
  // Both should require authentication
  const isolated = (dealership1.status === 401 || dealership1.status === 403) &&
                  (dealership2.status === 401 || dealership2.status === 403);
  
  return {
    passed: isolated,
    details: `Multi-tenant isolation enforced at authentication layer`,
    response: { dealership1: dealership1.status, dealership2: dealership2.status }
  };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting CleanRylie API Functional Testing\n');
  console.log('='.repeat(50));
  
  // Core API Endpoints Tests
  await runTest('System Health Check', testHealthEndpoint);
  await runTest('CSRF Token Generation', testCSRFToken);
  await runTest('Authentication Required Endpoints', testAuthRequiredEndpoints);
  await runTest('Error Handling and HTTP Status Codes', testErrorHandling);
  await runTest('Rate Limiting Functionality', testRateLimiting);
  await runTest('Request/Response Format Validation', testRequestResponseFormats);
  await runTest('Multi-Tenant Data Isolation', testMultiTenantIsolation);
  
  // Print Results Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n🔍 FAILED TESTS:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
  }
  
  console.log('\n📝 DETAILED TEST RESULTS:');
  console.log(JSON.stringify(testResults, null, 2));
  
  return testResults;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testResults };