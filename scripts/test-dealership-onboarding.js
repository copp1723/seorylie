#!/usr/bin/env node

/**
 * Dealership Onboarding API Test Script
 * 
 * Tests the complete onboarding flow for creating a new dealership
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.ONBOARDING_TEST_URL || 'http://localhost:10000/api/dealership-onboarding';
const TEST_SUBDOMAIN = `test-dealer-${Date.now()}`;

// Test dealership data
const testDealership = {
  name: 'Test Motors Group',
  subdomain: TEST_SUBDOMAIN,
  contact_email: 'contact@testmotors.com',
  contact_phone: '+14155551234',
  website_url: 'https://www.testmotors.com',
  address: {
    street: '123 Main Street',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US'
  },
  timezone: 'America/Los_Angeles',
  operation_mode: 'rylie_ai',
  admin: {
    first_name: 'John',
    last_name: 'Doe',
    email: `admin@${TEST_SUBDOMAIN}.com`,
    password: 'SecurePass123!',
    phone: '+14155555678'
  },
  integrations: {
    ga4_property_id: '320759942',
    ga4_measurement_id: 'G-ZJQKZZHVTM'
  }
};

// Helper function for API calls
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
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
async function testSubdomainCheck() {
  console.log('\n1. Testing Subdomain Availability...');
  console.log(`   Checking: ${TEST_SUBDOMAIN}`);
  
  const result = await makeRequest('POST', '/check-subdomain', {
    subdomain: TEST_SUBDOMAIN
  });
  
  if (result.success && result.data.available) {
    console.log('✅ Subdomain is available');
  } else {
    console.log('❌ Subdomain check failed or not available');
    console.log('   Response:', result.error || result.data);
  }
  
  return result.success && result.data.available;
}

async function testCreateDealership() {
  console.log('\n2. Testing Dealership Creation...');
  console.log(`   Creating: ${testDealership.name}`);
  
  const result = await makeRequest('POST', '/create', testDealership);
  
  if (result.success) {
    console.log('✅ Dealership created successfully');
    console.log('   Dealership ID:', result.data.dealership.id);
    console.log('   Subdomain:', result.data.dealership.subdomain);
    console.log('   URL:', result.data.dealership.url);
    console.log('   Admin Email:', result.data.admin.email);
    console.log('   API Key:', result.data.apiKey.substring(0, 20) + '...');
    return result.data.dealership.id;
  } else {
    console.log('❌ Dealership creation failed');
    console.log('   Status:', result.status);
    console.log('   Error:', result.error);
    return null;
  }
}

async function testGetProgress(dealershipId) {
  console.log('\n3. Testing Onboarding Progress...');
  console.log(`   Dealership ID: ${dealershipId}`);
  
  const result = await makeRequest('GET', `/progress/${dealershipId}`);
  
  if (result.success) {
    console.log('✅ Progress retrieved successfully');
    console.log('   Completion:', result.data.completionPercentage + '%');
    console.log('   Steps completed:');
    Object.entries(result.data.steps).forEach(([step, completed]) => {
      console.log(`     - ${step}: ${completed ? '✓' : '✗'}`);
    });
  } else {
    console.log('❌ Failed to get progress');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testUpdateSettings(dealershipId) {
  console.log('\n4. Testing Settings Update...');
  
  const newSettings = {
    chat_widget: {
      primary_color: '#007bff',
      welcome_message: 'Welcome to Test Motors! How can I help you today?',
      position: 'bottom-right'
    }
  };
  
  const result = await makeRequest('PATCH', `/settings/${dealershipId}`, newSettings);
  
  if (result.success) {
    console.log('✅ Settings updated successfully');
    console.log('   Chat widget configured');
  } else {
    console.log('❌ Failed to update settings');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testListDealerships() {
  console.log('\n5. Testing List Dealerships...');
  
  const result = await makeRequest('GET', '/list?limit=5');
  
  if (result.success) {
    console.log('✅ Dealerships list retrieved');
    console.log('   Total dealerships:', result.data.pagination.total);
    console.log('   Recent dealerships:');
    result.data.dealerships.slice(0, 3).forEach(d => {
      console.log(`     - ${d.name} (${d.subdomain}) - ${d.user_count} users`);
    });
  } else {
    console.log('❌ Failed to list dealerships');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

// Main test runner
async function runTests() {
  console.log('=== Dealership Onboarding API Test Suite ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Test Subdomain: ${TEST_SUBDOMAIN}`);
  
  let allPassed = true;
  let dealershipId = null;
  
  // Run tests in sequence
  const subdomainAvailable = await testSubdomainCheck();
  if (!subdomainAvailable) {
    console.log('\n⚠️  Cannot proceed - subdomain not available');
    return;
  }
  
  dealershipId = await testCreateDealership();
  if (!dealershipId) {
    console.log('\n⚠️  Cannot proceed - dealership creation failed');
    return;
  }
  
  // Wait a moment for data to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  allPassed &= await testGetProgress(dealershipId);
  allPassed &= await testUpdateSettings(dealershipId);
  allPassed &= await testListDealerships();
  
  // Summary
  console.log('\n=== Test Summary ===');
  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\nNext steps for complete onboarding:');
    console.log('1. Configure DNS for subdomain');
    console.log('2. Set up email integration (IMAP/SMTP)');
    console.log('3. Add inventory feed');
    console.log('4. Install chat widget on dealership website');
    console.log('5. Test end-to-end conversation flow');
  } else {
    console.log('❌ Some tests failed.');
    console.log('\nPlease check the errors above.');
  }
  
  console.log('\n=== Example CURL Commands ===');
  console.log('\n# Check subdomain availability:');
  console.log(`curl -X POST ${API_BASE_URL}/check-subdomain \\
  -H "Content-Type: application/json" \\
  -d '{"subdomain": "my-dealership"}'`);
  
  console.log('\n# Create dealership:');
  console.log(`curl -X POST ${API_BASE_URL}/create \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testDealership, null, 2)}'`);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});