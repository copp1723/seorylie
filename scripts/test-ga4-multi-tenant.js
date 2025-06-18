#!/usr/bin/env node

/**
 * GA4 Multi-Tenant Test Script
 * 
 * Tests the complete multi-tenant GA4 workflow
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.GA4_TEST_URL || 'https://seorylie.onrender.com/api/ga4';
const TEST_DEALERSHIP_ID = process.env.TEST_DEALERSHIP_ID || 'test-dealer-001';

// Rowdy's test properties
const TEST_PROPERTIES = [
  {
    name: 'Jay Hatfield Chevrolet of Vinita',
    property_id: '320759942',
    measurement_id: 'G-ZJQKZZHVTM',
    website_url: 'https://www.jayhatfieldchevroletvinita.com/'
  },
  {
    name: 'Jay Hatfield Motorsports of Wichita',
    property_id: '317592148',
    measurement_id: 'G-DBMQEB1TM0',
    website_url: 'https://www.kansasmotorsports.com/'
  }
];

// Helper for API calls
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
        'X-Dealership-Id': TEST_DEALERSHIP_ID
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
async function testGetInstructions() {
  console.log('\n1. Getting Onboarding Instructions...');
  
  const result = await makeRequest('GET', '/onboarding-instructions');
  
  if (result.success) {
    console.log('✅ Instructions retrieved');
    console.log(`   Service Account: ${result.data.serviceAccountEmail}`);
  } else {
    console.log('❌ Failed to get instructions');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testAddProperty(property) {
  console.log(`\n2. Adding GA4 Property: ${property.name}...`);
  console.log(`   Property ID: ${property.property_id}`);
  
  const result = await makeRequest('POST', '/properties', {
    property_id: property.property_id,
    property_name: property.name,
    measurement_id: property.measurement_id,
    website_url: property.website_url
  });
  
  if (result.success) {
    console.log('✅ Property added successfully');
    return true;
  } else {
    if (result.status === 409) {
      console.log('⚠️  Property already exists');
      return true; // Continue with test
    }
    console.log('❌ Failed to add property');
    console.log('   Error:', result.error);
    return false;
  }
}

async function testConnection(property) {
  console.log(`\n3. Testing Connection to ${property.name}...`);
  
  const result = await makeRequest('POST', '/properties/test-connection', {
    property_id: property.property_id
  });
  
  if (result.success) {
    console.log('✅ Connection successful!');
    console.log(`   Active users today: ${result.data.testData.activeUsersToday}`);
    return true;
  } else {
    console.log('❌ Connection failed');
    console.log('   Error:', result.error);
    
    if (result.error?.details?.serviceAccountEmail) {
      console.log('\n   ℹ️  To fix this:');
      console.log(`   1. Go to GA4 property ${property.property_id}`);
      console.log(`   2. Add ${result.error.details.serviceAccountEmail} as Viewer`);
      console.log('   3. Try again');
    }
    return false;
  }
}

async function testListProperties() {
  console.log('\n4. Listing All Properties...');
  
  const result = await makeRequest('GET', '/properties');
  
  if (result.success) {
    console.log('✅ Properties retrieved');
    console.log(`   Total properties: ${result.data.properties.length}`);
    
    result.data.properties.forEach(prop => {
      console.log(`   - ${prop.property_name || prop.property_id}: ${prop.sync_status}`);
    });
  } else {
    console.log('❌ Failed to list properties');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testGetSEOMetrics(property) {
  console.log(`\n5. Getting SEO Metrics for ${property.name}...`);
  
  const result = await makeRequest('GET', '/reports/seo-metrics?days=7');
  
  if (result.success) {
    console.log('✅ SEO metrics retrieved');
    console.log('   Data rows:', result.data.data.rows?.length || 0);
  } else {
    console.log('❌ Failed to get SEO metrics');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

async function testGetOrganicTraffic() {
  console.log('\n6. Getting Organic Traffic Data...');
  
  const result = await makeRequest('GET', '/reports/organic-traffic?days=30');
  
  if (result.success) {
    console.log('✅ Organic traffic data retrieved');
    console.log('   Data rows:', result.data.data.rows?.length || 0);
  } else {
    console.log('❌ Failed to get organic traffic');
    console.log('   Error:', result.error);
  }
  
  return result.success;
}

// Main test runner
async function runTests() {
  console.log('=== GA4 Multi-Tenant Test Suite ===');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Test Dealership ID: ${TEST_DEALERSHIP_ID}`);
  console.log(`Service Account: seo-ga4-service@onekeel-seo.iam.gserviceaccount.com`);
  
  let allPassed = true;
  
  // Get instructions
  allPassed &= await testGetInstructions();
  
  // Test with first property
  const testProperty = TEST_PROPERTIES[0];
  
  // Add property
  const propertyAdded = await testAddProperty(testProperty);
  if (!propertyAdded) {
    console.log('\n⚠️  Cannot continue without adding property');
    return;
  }
  
  // Test connection
  const connectionSuccess = await testConnection(testProperty);
  
  // List all properties
  allPassed &= await testListProperties();
  
  // If connection successful, test reports
  if (connectionSuccess) {
    allPassed &= await testGetSEOMetrics(testProperty);
    allPassed &= await testGetOrganicTraffic();
  }
  
  // Summary
  console.log('\n=== Test Summary ===');
  if (allPassed && connectionSuccess) {
    console.log('✅ All tests passed!');
    console.log('\nThe multi-tenant GA4 integration is working correctly.');
  } else if (!connectionSuccess) {
    console.log('⚠️  Connection test failed.');
    console.log('\nNext steps:');
    console.log('1. Ask Rowdy to add the service account to the GA4 property');
    console.log('2. Wait a few minutes for permissions to propagate');
    console.log('3. Run this test again');
  } else {
    console.log('❌ Some tests failed.');
    console.log('\nPlease check the errors above.');
  }
  
  console.log('\n=== Quick Reference ===');
  console.log('\nService account to share with Rowdy:');
  console.log('seo-ga4-service@onekeel-seo.iam.gserviceaccount.com');
  
  console.log('\nTest Properties:');
  TEST_PROPERTIES.forEach(prop => {
    console.log(`\n${prop.name}`);
    console.log(`Property ID: ${prop.property_id}`);
    console.log(`Measurement ID: ${prop.measurement_id}`);
  });
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});