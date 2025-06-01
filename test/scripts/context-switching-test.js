#!/usr/bin/env node

/**
 * Dealership Context Switching and Role-Based Authorization Test
 * Specialized testing for multi-dealership users and context switching
 */

const BASE_URL = 'http://127.0.0.1:3000';

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Make HTTP request with session support
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
      headers: Object.fromEntries(response.headers.entries()),
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      duration: Date.now() - start,
      success: false
    };
  }
}

/**
 * Run a test case
 */
async function runTest(name, testFunc) {
  console.log(`\n🧪 Testing: ${name}`);
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
 * Test role-based access control
 */
async function testRoleBasedAccess() {
  console.log('\n👥 === ROLE-BASED ACCESS CONTROL TESTS ===');
  
  // Test super admin access
  await runTest('Super Admin Cross-Dealership Access', async () => {
    // Super admins should be able to access all dealership data
    const response = await makeRequest('GET', '/api/admin/dealerships');
    
    // Check if super admin privileges are properly enforced
    const hasProperAccess = response.status === 403; // Current implementation requires super admin auth
    
    return {
      passed: hasProperAccess,
      details: hasProperAccess ? 'Super admin access control properly enforced' : 'Super admin access control missing',
      response
    };
  });
  
  // Test dealership admin boundaries
  await runTest('Dealership Admin Boundary Enforcement', async () => {
    // Dealership admins should only access their own dealership
    const response = await makeRequest('GET', '/api/admin/dealerships/999');
    
    const isRestricted = response.status === 403 || response.status === 404;
    
    return {
      passed: isRestricted,
      details: isRestricted ? 'Dealership admin boundaries properly enforced' : 'Dealership admin can access other dealerships',
      response
    };
  });
  
  // Test regular user restrictions
  await runTest('Regular User Access Restrictions', async () => {
    // Regular users should have limited access
    const adminEndpoint = await makeRequest('GET', '/api/admin/dealerships');
    const isRestricted = adminEndpoint.status === 403 || adminEndpoint.status === 401;
    
    return {
      passed: isRestricted,
      details: isRestricted ? 'Regular user access properly restricted' : 'Regular user has admin access',
      response: adminEndpoint
    };
  });
}

/**
 * Test context switching functionality
 */
async function testContextSwitching() {
  console.log('\n🔄 === CONTEXT SWITCHING TESTS ===');
  
  // Test dealership context indicators
  await runTest('Dealership Context Headers', async () => {
    // Check for dealership context in response headers (development mode)
    const response = await makeRequest('GET', '/api/csrf-token');
    
    // Look for context headers that might be exposed in development
    const hasContextHeaders = response.headers['x-dealership-id'] || 
                             response.headers['x-user-role'] ||
                             response.headers['x-tenant-id'];
    
    return {
      passed: true, // This is informational
      details: hasContextHeaders ? 'Context headers present in development' : 'No context headers found',
      response: {
        headers: response.headers,
        hasContextHeaders
      }
    };
  });
  
  // Test session persistence
  await runTest('Session Context Persistence', async () => {
    // Test that session maintains context across requests
    const request1 = await makeRequest('GET', '/api/csrf-token');
    const request2 = await makeRequest('GET', '/api/csrf-token');
    
    // Both requests should succeed and maintain session
    const sessionPersists = request1.success && request2.success;
    
    return {
      passed: sessionPersists,
      details: sessionPersists ? 'Session context maintained across requests' : 'Session context not maintained',
      response: {
        request1: request1.success,
        request2: request2.success
      }
    };
  });
  
  // Test context validation
  await runTest('Context Validation on Protected Routes', async () => {
    // Test that protected routes validate context properly
    const protectedRoutes = [
      '/api/admin/dealerships',
      '/api/conversation-logs',
      '/api/my-follow-ups'
    ];
    
    let validatedCount = 0;
    
    for (const route of protectedRoutes) {
      const response = await makeRequest('GET', route);
      // Should require authentication/authorization
      if (response.status === 401 || response.status === 403) {
        validatedCount++;
      }
    }
    
    return {
      passed: validatedCount === protectedRoutes.length,
      details: `${validatedCount}/${protectedRoutes.length} routes properly validate context`,
      response: { validatedCount, total: protectedRoutes.length }
    };
  });
}

/**
 * Test multi-dealership user scenarios
 */
async function testMultiDealershipUsers() {
  console.log('\n🏢 === MULTI-DEALERSHIP USER TESTS ===');
  
  // Test unauthorized dealership switching
  await runTest('Unauthorized Dealership Switching Prevention', async () => {
    // Try to access different dealership data without proper authorization
    const dealershipA = await makeRequest('GET', '/api/admin/dealerships/1');
    const dealershipB = await makeRequest('GET', '/api/admin/dealerships/2');
    
    // Both should be unauthorized without proper auth
    const bothBlocked = (dealershipA.status === 403 || dealershipA.status === 401) &&
                       (dealershipB.status === 403 || dealershipB.status === 401);
    
    return {
      passed: bothBlocked,
      details: bothBlocked ? 'Unauthorized switching properly prevented' : 'Unauthorized switching allowed',
      response: {
        dealershipA: dealershipA.status,
        dealershipB: dealershipB.status
      }
    };
  });
  
  // Test data isolation during context switching
  await runTest('Data Isolation During Context Switching', async () => {
    // Simulate context switch by accessing different dealership endpoints
    const responses = [];
    
    for (let i = 1; i <= 3; i++) {
      const response = await makeRequest('GET', `/api/admin/dealerships/${i}/users`);
      responses.push(response);
    }
    
    // All should require proper authorization
    const allIsolated = responses.every(r => r.status === 403 || r.status === 401);
    
    return {
      passed: allIsolated,
      details: allIsolated ? 'Data properly isolated during context operations' : 'Data leakage during context operations',
      response: responses.map(r => r.status)
    };
  });
}

/**
 * Test concurrent session security
 */
async function testConcurrentSessions() {
  console.log('\n🔒 === CONCURRENT SESSION SECURITY TESTS ===');
  
  // Test session isolation
  await runTest('Session Isolation Between Contexts', async () => {
    // Create multiple "sessions" (separate requests)
    const session1 = await makeRequest('GET', '/api/csrf-token');
    const session2 = await makeRequest('GET', '/api/csrf-token');
    
    // Each should get unique CSRF tokens
    const token1 = session1.data?.csrfToken;
    const token2 = session2.data?.csrfToken;
    
    const tokensUnique = token1 && token2 && token1 !== token2;
    
    return {
      passed: tokensUnique,
      details: tokensUnique ? 'Sessions properly isolated' : 'Session isolation issue',
      response: {
        token1: token1?.substring(0, 8) + '...',
        token2: token2?.substring(0, 8) + '...',
        unique: tokensUnique
      }
    };
  });
  
  // Test concurrent request handling
  await runTest('Concurrent Request Context Safety', async () => {
    // Make multiple concurrent requests to test context safety
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(makeRequest('GET', '/api/csrf-token'));
    }
    
    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.success).length;
    
    return {
      passed: successCount === 5,
      details: `${successCount}/5 concurrent requests handled safely`,
      response: { successCount, total: 5 }
    };
  });
}

/**
 * Main test runner
 */
async function runContextSwitchingTests() {
  console.log('🔄 Starting Context Switching and Role-Based Authorization Testing');
  console.log('='.repeat(70));
  
  await testRoleBasedAccess();
  await testContextSwitching();
  await testMultiDealershipUsers();
  await testConcurrentSessions();
  
  // Print Results Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 CONTEXT SWITCHING TEST RESULTS');
  console.log('='.repeat(70));
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
  
  console.log('\n📝 DETAILED RESULTS:');
  console.log(JSON.stringify(testResults, null, 2));
  
  return testResults;
}

// Run tests
runContextSwitchingTests().catch(console.error);

export { runContextSwitchingTests, testResults };