#!/usr/bin/env node

/**
 * SEOWerks API Test Script
 * 
 * This script tests the SEOWerks webhook integration
 * Run with: npm run test:seoworks
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.SEOWORKS_TEST_URL || 'https://seorylie.onrender.com/api/seoworks';
const API_KEY = process.env.SEO_WORKS_API_KEY;

if (!API_KEY) {
  console.error('❌ SEO_WORKS_API_KEY not found in .env file');
  console.log('Please add SEO_WORKS_API_KEY=your-api-key to your .env file');
  process.exit(1);
}

// Test data
const testTask = {
  id: `test-${Date.now()}`,
  task_type: 'blog_post',
  status: 'completed',
  dealership_id: 'test-dealer-001',
  post_title: 'Test Blog Post: Top 10 Car Maintenance Tips',
  post_url: 'https://example.com/blog/car-maintenance-tips',
  completion_date: new Date().toISOString(),
  completion_notes: 'Successfully generated and published blog post',
  payload: {
    word_count: 1250,
    keywords: ['car maintenance', 'auto care', 'vehicle tips'],
    meta_description: 'Discover the top 10 car maintenance tips to keep your vehicle running smoothly.',
    publication_date: new Date().toISOString()
  }
};

// Helper function for API calls
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    };

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
async function testHealthCheck() {
  console.log('\n1. Testing Health Check (no auth required)...');
  const result = await makeRequest('GET', '/health');
  
  if (result.success) {
    console.log('✅ Health check passed');
    console.log('   Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Health check failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testAuthEndpoint() {
  console.log('\n2. Testing Authenticated Test Endpoint...');
  const testData = { message: 'Hello from Jeff!' };
  const result = await makeRequest('POST', '/test', testData);
  
  if (result.success) {
    console.log('✅ Auth test passed');
    console.log('   Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Auth test failed');
    console.log('   Status:', result.status);
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testTaskWebhook() {
  console.log('\n3. Testing Task Webhook...');
  console.log('   Sending task:', testTask.id);
  
  const result = await makeRequest('POST', '/task', testTask);
  
  if (result.success) {
    console.log('✅ Task webhook passed');
    console.log('   Response:', JSON.stringify(result.data, null, 2));
    return testTask.id;
  } else {
    console.log('❌ Task webhook failed');
    console.log('   Status:', result.status);
    console.log('   Error:', result.error);
    return null;
  }
}

async function testGetTask(taskId) {
  console.log('\n4. Testing Get Task Status...');
  console.log('   Task ID:', taskId);
  
  const result = await makeRequest('GET', `/task/${taskId}`);
  
  if (result.success) {
    console.log('✅ Get task passed');
    console.log('   Task status:', result.data.task.status);
    console.log('   Last updated:', result.data.task.updated_at);
  } else {
    console.log('❌ Get task failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testListTasks() {
  console.log('\n5. Testing List Tasks...');
  
  const result = await makeRequest('GET', '/tasks?limit=10');
  
  if (result.success) {
    console.log('✅ List tasks passed');
    console.log('   Total tasks:', result.data.pagination.total);
    console.log('   Tasks returned:', result.data.tasks.length);
  } else {
    console.log('❌ List tasks failed');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

// Main test runner
async function runTests() {
  console.log('=== SEOWerks API Test Suite ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`);
  
  let allPassed = true;
  
  // Run tests in sequence
  allPassed &= await testHealthCheck();
  allPassed &= await testAuthEndpoint();
  
  const taskId = await testTaskWebhook();
  if (taskId) {
    // Wait a moment for DB write
    await new Promise(resolve => setTimeout(resolve, 1000));
    allPassed &= await testGetTask(taskId);
  } else {
    allPassed = false;
  }
  
  allPassed &= await testListTasks();
  
  // Summary
  console.log('\n=== Test Summary ===');
  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\nThe SEOWerks API integration is working correctly.');
  } else {
    console.log('❌ Some tests failed.');
    console.log('\nPlease check the errors above and ensure:');
    console.log('1. The API key is correctly configured');
    console.log('2. The database table exists');
    console.log('3. The server is running and accessible');
  }
  
  console.log('\n=== Example CURL Commands ===');
  console.log('\n# Health check:');
  console.log(`curl ${API_BASE_URL}/health`);
  
  console.log('\n# Send a task (replace YOUR_API_KEY):');
  console.log(`curl -X POST ${API_BASE_URL}/task \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "task-123",
    "task_type": "blog_post",
    "status": "completed",
    "post_title": "Sample Blog Post",
    "post_url": "https://example.com/blog/sample"
  }'`);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});