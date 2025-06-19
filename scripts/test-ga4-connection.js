#!/usr/bin/env node

/**
 * GA4 Connection Test Script
 * Tests the service account connection to Rowdy's GA4 properties
 */

require('dotenv').config();
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Initialize the client
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: process.env.GA4_KEY_FILE_PATH || './server/config/ga4-service-account-key.json'
});

const TEST_PROPERTIES = [
  {
    name: 'Jay Hatfield Chevrolet of Vinita',
    propertyId: '320759942',
    measurementId: 'G-ZJQKZZHVTM'
  },
  {
    name: 'Jay Hatfield Motorsports of Wichita',
    propertyId: '317592148',
    measurementId: 'G-DBMQEB1TM0'
  }
];

async function testPropertyAccess(property) {
  console.log(`\nTesting: ${property.name}`);
  console.log(`Property ID: ${property.propertyId}`);
  
  try {
    // Simple test query - get active users for today
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${property.propertyId}`,
      dateRanges: [
        {
          startDate: 'today',
          endDate: 'today'
        }
      ],
      metrics: [
        {
          name: 'activeUsers'
        }
      ]
    });
    
    console.log('✓ Successfully connected!');
    
    if (response.rows && response.rows.length > 0) {
      const activeUsers = response.rows[0].metricValues[0].value;
      console.log(`  Active users today: ${activeUsers}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Connection failed!');
    console.log(`  Error: ${error.message}`);
    
    if (error.code === 7) {
      console.log('  → Permission denied. The service account needs to be added to this property.');
    } else if (error.code === 3) {
      console.log('  → Invalid property ID or configuration issue.');
    }
    
    return false;
  }
}

async function main() {
  console.log('=== GA4 Service Account Connection Test ===\n');
  
  // Check if credentials are configured
  if (!process.env.GA4_SERVICE_ACCOUNT_EMAIL) {
    console.log('❌ GA4_SERVICE_ACCOUNT_EMAIL not found in .env');
    console.log('Please run: node scripts/configure-ga4-credentials.js first');
    process.exit(1);
  }
  
  console.log(`Service Account: ${process.env.GA4_SERVICE_ACCOUNT_EMAIL}`);
  
  let successCount = 0;
  
  for (const property of TEST_PROPERTIES) {
    const success = await testPropertyAccess(property);
    if (success) successCount++;
  }
  
  console.log('\n=== Summary ===');
  console.log(`Properties tested: ${TEST_PROPERTIES.length}`);
  console.log(`Successful connections: ${successCount}`);
  
  if (successCount === 0) {
    console.log('\n⚠️  No properties are accessible yet.');
    console.log('Please ensure Rowdy has added the service account to the GA4 properties.');
    console.log(`Service account email: ${process.env.GA4_SERVICE_ACCOUNT_EMAIL}`);
  } else if (successCount < TEST_PROPERTIES.length) {
    console.log('\n⚠️  Some properties are not accessible yet.');
    console.log('Please check that all properties have been configured.');
  } else {
    console.log('\n✅ All properties are accessible!');
    console.log('GA4 integration is ready to use.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});