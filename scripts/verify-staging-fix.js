#!/usr/bin/env node

/**
 * Verify Staging Fix Script
 * Tests if the staging deployment is working correctly after Redis fix
 */

const https = require('https');
const http = require('http');

// Configuration
const STAGING_URL = process.env.STAGING_URL || 'https://your-staging-url.onrender.com';
const TIMEOUT = 10000; // 10 seconds

console.log('🔍 CleanRylie Staging Verification Script');
console.log('=========================================');
console.log(`🎯 Testing: ${STAGING_URL}`);
console.log('');

// Test endpoints
const endpoints = [
  { path: '/', name: 'Homepage', critical: true },
  { path: '/api/health', name: 'Health Check', critical: true },
  { path: '/api/auth/status', name: 'Auth Status', critical: false }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, STAGING_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    
    const req = client.get(url, { timeout: TIMEOUT }, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = {
          name: endpoint.name,
          path: endpoint.path,
          status: res.statusCode,
          responseTime,
          success: res.statusCode >= 200 && res.statusCode < 400,
          data: data.substring(0, 200) // First 200 chars
        };
        resolve(result);
      });
    });
    
    req.on('error', (error) => {
      resolve({
        name: endpoint.name,
        path: endpoint.path,
        status: 0,
        responseTime: Date.now() - startTime,
        success: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: endpoint.name,
        path: endpoint.path,
        status: 0,
        responseTime: TIMEOUT,
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

async function runTests() {
  console.log('🚀 Starting endpoint tests...\n');
  
  const results = [];
  let criticalFailures = 0;
  
  for (const endpoint of endpoints) {
    console.log(`⏳ Testing ${endpoint.name} (${endpoint.path})...`);
    
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ ${result.status} - ${result.responseTime}ms`);
    } else {
      console.log(`   ❌ ${result.status || 'ERROR'} - ${result.error || 'Failed'}`);
      if (endpoint.critical) {
        criticalFailures++;
      }
    }
    
    // Brief pause between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}: ${result.status} (${result.responseTime}ms)`);
    
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });
  
  console.log('\n🎯 Overall Status:');
  if (criticalFailures === 0) {
    console.log('✅ All critical endpoints are working!');
    console.log('🎉 Your staging deployment appears to be fixed!');
    
    // Check for Redis-related success indicators
    const healthResult = results.find(r => r.path === '/api/health');
    if (healthResult && healthResult.success) {
      console.log('\n💡 Health check passed - Redis fallback is likely working correctly');
    }
  } else {
    console.log(`❌ ${criticalFailures} critical endpoint(s) failed`);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check Render deployment logs');
    console.log('2. Verify SKIP_REDIS=true is set in environment variables');
    console.log('3. Ensure the service has been redeployed after setting the variable');
    console.log('4. Check database connection (DATABASE_URL)');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('- If tests pass: Your Redis fix worked! 🎉');
  console.log('- If tests fail: Check the troubleshooting steps above');
  console.log('- Monitor logs: Look for "Redis disabled" or "mock Redis client" messages');
  
  process.exit(criticalFailures > 0 ? 1 : 0);
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node verify-staging-fix.js [STAGING_URL]');
  console.log('');
  console.log('Environment Variables:');
  console.log('  STAGING_URL - Your staging deployment URL');
  console.log('');
  console.log('Example:');
  console.log('  STAGING_URL=https://your-app.onrender.com node verify-staging-fix.js');
  process.exit(0);
}

// Override URL if provided as argument
if (process.argv[2]) {
  process.env.STAGING_URL = process.argv[2];
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
