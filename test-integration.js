#!/usr/bin/env node

// Test script to verify GA4 and SEOWerks integration
const http = require('http');
const https = require('https');

const API_URL = process.env.API_URL || 'http://localhost:10000';

async function makeRequest(path, method = 'GET', data = null) {
  const url = new URL(path, API_URL);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
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

async function runTests() {
  console.log(`\n🧪 Testing API at: ${API_URL}\n`);
  
  try {
    // Test 1: Health check
    console.log('1️⃣  Testing health endpoint...');
    const health = await makeRequest('/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Database: ${health.data.database || 'unknown'}`);
    
    // Test 2: SEOWerks webhook
    console.log('\n2️⃣  Testing SEOWerks webhook...');
    const webhookData = {
      id: `test-${Date.now()}`,
      task_type: 'seo_audit',
      status: 'completed',
      completion_date: new Date().toISOString(),
      data: {
        url: 'https://example.com',
        score: 85,
        issues: ['missing meta description', 'slow page load']
      }
    };
    
    const webhook = await makeRequest('/api/seoworks/webhook', 'POST', webhookData);
    console.log(`   Status: ${webhook.status}`);
    console.log(`   Task ID: ${webhook.data.task_id}`);
    
    // Test 3: Get SEOWerks tasks
    console.log('\n3️⃣  Getting SEOWerks tasks...');
    const tasks = await makeRequest('/api/seoworks/tasks');
    console.log(`   Status: ${tasks.status}`);
    console.log(`   Tasks found: ${tasks.data.count}`);
    if (tasks.data.tasks && tasks.data.tasks.length > 0) {
      console.log(`   Latest task: ${tasks.data.tasks[0].external_id} - ${tasks.data.tasks[0].status}`);
    }
    
    // Test 4: Create GA4 property
    console.log('\n4️⃣  Creating GA4 property...');
    const propertyData = {
      dealership_id: '123e4567-e89b-12d3-a456-426614174000',
      property_id: '320759942',
      property_name: 'Test Dealership GA4',
      measurement_id: 'G-XXXXXXX',
      website_url: 'https://test-dealership.com'
    };
    
    const property = await makeRequest('/api/ga4/properties', 'POST', propertyData);
    console.log(`   Status: ${property.status}`);
    if (property.status === 201) {
      console.log(`   Property created with ID: ${property.data.property.id}`);
    }
    
    // Test 5: Get GA4 properties
    console.log('\n5️⃣  Getting GA4 properties...');
    const properties = await makeRequest('/api/ga4/properties');
    console.log(`   Status: ${properties.status}`);
    console.log(`   Properties found: ${properties.data.count}`);
    
    // Test 6: Chat interface
    console.log('\n6️⃣  Testing chat interface...');
    const chat = await makeRequest('/chat');
    console.log(`   Status: ${chat.status}`);
    console.log(`   Chat UI available: ${chat.status === 200 ? '✅' : '❌'}`);
    
    console.log('\n✅ All tests completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure the server is running:');
    console.error('  npm start');
  }
}

// Run tests
runTests();