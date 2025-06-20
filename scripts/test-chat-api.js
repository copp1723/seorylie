#!/usr/bin/env node

/**
 * Chat Assistant API Test Script
 * Tests the new enhanced chat API endpoints
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_DEALERSHIP_ID = 'test-dealer-001';

// Mock auth token (in production, this would be a real JWT)
const AUTH_TOKEN = 'mock-jwt-token';

// Helper function for API calls
async function makeRequest(method, endpoint, data = null, auth = true) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (auth) {
      config.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status 
    };
  }
}

// Test functions
async function testTaskStatusAPI() {
  console.log('\n1. Testing Task Status API...');
  
  const result = await makeRequest('GET', `/api/tasks/status?dealershipId=${TEST_DEALERSHIP_ID}`);
  
  if (result.success) {
    console.log('✅ Task status API working');
    console.log('   Response structure:', {
      success: result.data.success,
      hasTaskSummary: !!result.data.taskSummary,
      hasRecentCompletions: !!result.data.recentCompletions
    });
  } else {
    console.log('❌ Task status API failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testAnalyticsAPI() {
  console.log('\n2. Testing Analytics Summary API...');
  
  const result = await makeRequest('GET', `/api/tasks/analytics-summary?dealershipId=${TEST_DEALERSHIP_ID}`);
  
  if (result.success) {
    console.log('✅ Analytics API working');
    console.log('   Response structure:', {
      success: result.data.success,
      hasGA4: result.data.hasGA4,
      hasAnalytics: !!result.data.analytics
    });
  } else {
    console.log('❌ Analytics API failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testPackageInfoAPI() {
  console.log('\n3. Testing Package Info API...');
  
  const result = await makeRequest('GET', `/api/tasks/package-info?dealershipId=${TEST_DEALERSHIP_ID}`);
  
  if (result.success) {
    console.log('✅ Package info API working');
    console.log('   Response structure:', {
      success: result.data.success,
      hasDealership: !!result.data.dealership,
      hasPackage: !!result.data.package
    });
  } else {
    console.log('❌ Package info API failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testChatMessageAPI() {
  console.log('\n4. Testing Enhanced Chat API...');
  
  const testMessages = [
    'What tasks have been completed?',
    'What are my weekly analytics?',
    'What\'s included in my SEO package?',
    'How does my F-150 compare to competitors?',
    'How can I improve my SEO?'
  ];
  
  let successCount = 0;
  
  for (const message of testMessages) {
    console.log(`\n   Testing message: "${message}"`);
    
    const result = await makeRequest('POST', '/api/chat/message', {
      message,
      dealershipId: TEST_DEALERSHIP_ID
    });
    
    if (result.success) {
      console.log('   ✅ Response received');
      console.log('   📝 Category:', result.data.category || 'general');
      console.log('   🔘 Has request button:', result.data.hasRequestButton);
      successCount++;
    } else {
      console.log('   ❌ Message failed');
      console.log('   Error:', result.error);
    }
  }
  
  console.log(`\n   Summary: ${successCount}/${testMessages.length} messages processed successfully`);
  return successCount === testMessages.length;
}

async function testChatRequestSubmission() {
  console.log('\n5. Testing Chat Request Submission...');
  
  const testRequest = {
    type: 'seo-improvement',
    query: 'Test request from chat assistant API test',
    context: { test: true },
    dealershipId: TEST_DEALERSHIP_ID
  };
  
  const result = await makeRequest('POST', '/api/tasks/chat-request', testRequest);
  
  if (result.success) {
    console.log('✅ Chat request submission working');
    console.log('   Request ID:', result.data.request?.id);
    console.log('   Message:', result.data.message);
  } else {
    console.log('❌ Chat request submission failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testHealthCheck() {
  console.log('\n0. Testing Server Health...');
  
  const result = await makeRequest('GET', '/health', null, false);
  
  if (result.success) {
    console.log('✅ Server is healthy');
    console.log('   Environment:', result.data.environment);
    console.log('   Status:', result.data.status);
  } else {
    console.log('❌ Server health check failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

// Main test runner
async function runTests() {
  console.log('=== Chat Assistant API Test Suite ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Test Dealership: ${TEST_DEALERSHIP_ID}`);
  
  let allPassed = true;
  
  // Run tests in sequence
  allPassed &= await testHealthCheck();
  allPassed &= await testTaskStatusAPI();
  allPassed &= await testAnalyticsAPI();
  allPassed &= await testPackageInfoAPI();
  allPassed &= await testChatMessageAPI();
  allPassed &= await testChatRequestSubmission();
  
  // Summary
  console.log('\n=== Test Summary ===');
  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\nThe Chat Assistant API is working correctly.');
    console.log('\nNext steps:');
    console.log('1. Update frontend to use new API endpoints');
    console.log('2. Run database migrations for new tables');
    console.log('3. Configure authentication for production');
  } else {
    console.log('❌ Some tests failed.');
    console.log('\nPlease check:');
    console.log('1. Server is running and accessible');
    console.log('2. Database is connected and migrations run');
    console.log('3. All route files are properly imported');
  }
  
  console.log('\n=== Example Frontend Integration ===');
  console.log(`
// Frontend service call example:
const response = await fetch('/api/chat/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + userToken
  },
  body: JSON.stringify({
    message: 'What tasks have been completed?',
    dealershipId: currentDealership.id
  })
});

const chatResponse = await response.json();
if (chatResponse.hasRequestButton) {
  // Show "Submit Request to SEO Team" button
  // When clicked, call /api/chat/submit-request
}
`);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

