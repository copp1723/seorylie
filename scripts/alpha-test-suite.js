#!/usr/bin/env node

/**
 * Alpha Test Suite
 * Comprehensive testing of all chat assistant and escalation flows
 */

require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:10000';
const WS_URL = SERVER_URL.replace('http', 'ws');

let authToken = null;
let testResults = [];

function log(message, status = 'info') {
  const timestamp = new Date().toISOString();
  const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : 'ℹ️';
  console.log(`${emoji} [${timestamp}] ${message}`);
}

async function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testAuthentication() {
  log('Testing Authentication Flow...', 'info');
  
  const response = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@alphatest.com',
    password: 'TestPass123!'
  });
  
  if (response.status === 200 && response.data.token) {
    authToken = response.data.token;
    log('Authentication successful', 'success');
    testResults.push({ test: 'Authentication', status: 'PASS' });
    return true;
  } else {
    log(`Authentication failed: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
    testResults.push({ test: 'Authentication', status: 'FAIL', error: response.data });
    return false;
  }
}

async function testTaskStatusAPI() {
  log('Testing Task Status API...', 'info');
  
  const response = await makeRequest('/api/seoworks/task-status');
  
  if (response.status === 200 && response.data.tasks && Array.isArray(response.data.tasks)) {
    log(`Found ${response.data.tasks.length} tasks`, 'success');
    testResults.push({ test: 'Task Status API', status: 'PASS', data: response.data });
    return true;
  } else {
    log(`Task Status API failed: ${response.status}`, 'error');
    testResults.push({ test: 'Task Status API', status: 'FAIL', error: response.data });
    return false;
  }
}

async function testAnalyticsSummary() {
  log('Testing Analytics Summary API...', 'info');
  
  const response = await makeRequest('/api/analytics/summary');
  
  if (response.status === 200 && response.data.summary) {
    log('Analytics summary retrieved successfully', 'success');
    testResults.push({ test: 'Analytics Summary', status: 'PASS', data: response.data });
    return true;
  } else {
    log(`Analytics Summary failed: ${response.status}`, 'error');
    testResults.push({ test: 'Analytics Summary', status: 'FAIL', error: response.data });
    return false;
  }
}

async function testPackageInfo() {
  log('Testing Package Info API...', 'info');
  
  const response = await makeRequest('/api/seoworks/package-info');
  
  if (response.status === 200 && response.data.package) {
    log(`Package: ${response.data.package.name} (${response.data.package.tier})`, 'success');
    testResults.push({ test: 'Package Info', status: 'PASS', data: response.data });
    return true;
  } else {
    log(`Package Info failed: ${response.status}`, 'error');
    testResults.push({ test: 'Package Info', status: 'FAIL', error: response.data });
    return false;
  }
}

async function testChatMessage() {
  log('Testing Chat Message API...', 'info');
  
  const response = await makeRequest('/api/chat/message', 'POST', {
    message: 'What is the status of my recent SEO tasks?',
    conversation_id: 'test-conversation-001'
  });
  
  if (response.status === 200 && response.data.response) {
    log('Chat message processed successfully', 'success');
    testResults.push({ test: 'Chat Message', status: 'PASS', data: response.data });
    return true;
  } else {
    log(`Chat Message failed: ${response.status}`, 'error');
    testResults.push({ test: 'Chat Message', status: 'FAIL', error: response.data });
    return false;
  }
}

async function testEscalationRequest() {
  log('Testing Escalation Request...', 'info');
  
  const response = await makeRequest('/api/seo/request', 'POST', {
    request_type: 'content_creation',
    priority: 'medium',
    description: 'I need a new blog post about Ford F-150 winter driving tips',
    additional_context: 'Target audience: Bay Area Ford customers'
  });
  
  if (response.status === 201 && response.data.request_id) {
    log(`Escalation created with ID: ${response.data.request_id}`, 'success');
    testResults.push({ test: 'Escalation Request', status: 'PASS', data: response.data });
    return true;
  } else {
    log(`Escalation Request failed: ${response.status}`, 'error');
    testResults.push({ test: 'Escalation Request', status: 'FAIL', error: response.data });
    return false;
  }
}

async function testWebSocketConnection() {
  log('Testing WebSocket Connection...', 'info');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}/ws?token=${authToken}`);
    let connected = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        log('WebSocket connection timeout', 'error');
        testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: 'Timeout' });
        resolve(false);
      }
    }, 5000);
    
    ws.on('open', () => {
      connected = true;
      clearTimeout(timeout);
      log('WebSocket connected successfully', 'success');
      
      // Test sending a message
      ws.send(JSON.stringify({
        type: 'chat_message',
        data: { message: 'Hello from WebSocket test', conversation_id: 'ws-test-001' }
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        log(`WebSocket message received: ${message.type}`, 'success');
        testResults.push({ test: 'WebSocket Connection', status: 'PASS', data: message });
        ws.close();
        resolve(true);
      } catch (e) {
        log(`WebSocket message parse error: ${e.message}`, 'error');
        testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: e.message });
        ws.close();
        resolve(false);
      }
    });
    
    ws.on('error', (error) => {
      connected = true; // Prevent timeout from firing
      clearTimeout(timeout);
      log(`WebSocket error: ${error.message}`, 'error');
      testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: error.message });
      resolve(false);
    });
  });
}

async function runAlphaTests() {
  console.log('🚀 Starting Alpha Test Suite\n');
  
  // Test 1: Authentication
  const authSuccess = await testAuthentication();
  if (!authSuccess) {
    log('Stopping tests - authentication required', 'error');
    return;
  }
  
  // Test 2: Core API Endpoints
  await testTaskStatusAPI();
  await testAnalyticsSummary();
  await testPackageInfo();
  
  // Test 3: Chat Assistant
  await testChatMessage();
  
  // Test 4: Escalation Flow
  await testEscalationRequest();
  
  // Test 5: WebSocket (if available)
  try {
    await testWebSocketConnection();
  } catch (e) {
    log(`WebSocket test skipped: ${e.message}`, 'info');
    testResults.push({ test: 'WebSocket Connection', status: 'SKIP', error: e.message });
  }
  
  // Results Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const skipped = testResults.filter(r => r.status === 'SKIP').length;
  
  testResults.forEach(result => {
    const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${emoji} ${result.test}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${JSON.stringify(result.error)}`);
    }
  });
  
  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your alpha environment is ready for testing.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the errors above.');
  }
}

// Run the tests
runAlphaTests().catch(console.error);

