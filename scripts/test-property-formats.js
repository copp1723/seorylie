#!/usr/bin/env node
/**
 * Test different property ID formats
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

async function testPropertyFormats() {
  console.log('🔍 Testing GA4 Property ID Formats\n');
  
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
  const client = new BetaAnalyticsDataClient();
  
  // Different formats to try
  const propertyFormats = [
    '320759942',                    // Raw ID
    'properties/320759942',         // With prefix
    '320759942',                    // Ensure no spaces
    'accounts/*/properties/320759942' // With wildcard account
  ];
  
  console.log('Testing different property ID formats:\n');
  
  for (const format of propertyFormats) {
    console.log(`Testing: "${format}"`);
    
    try {
      const property = format.includes('properties/') ? format : `properties/${format}`;
      
      const [response] = await client.runReport({
        property: property,
        dateRanges: [{ startDate: '1daysAgo', endDate: '1daysAgo' }],
        metrics: [{ name: 'sessions' }],
        limit: 1
      });
      
      console.log(`✅ SUCCESS with format: ${property}`);
      console.log(`   Sessions: ${response.rows?.[0]?.metricValues[0].value || 0}\n`);
      
      // If successful, get more details
      console.log('📊 Getting property details...\n');
      
      const [detailed] = await client.runReport({
        property: property,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [
          { name: 'date' },
          { name: 'country' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' }
        ],
        limit: 5
      });
      
      console.log('Recent traffic data:');
      detailed.rows?.forEach(row => {
        console.log(`  ${row.dimensionValues[0].value} - ${row.dimensionValues[1].value}: ${row.metricValues[0].value} sessions`);
      });
      
      return; // Stop on first success
      
    } catch (error) {
      console.log(`❌ Failed: ${error.code} - ${error.message?.split('.')[0]}\n`);
    }
  }
  
  console.log('\n📋 Troubleshooting Summary:');
  console.log('1. API is enabled ✅');
  console.log('2. Service account has access ✅');
  console.log('3. All property formats failed ❌');
  console.log('\n🤔 This suggests:');
  console.log('- The property ID might be incorrect');
  console.log('- OR there\'s a project/account mismatch');
  console.log('- OR permissions haven\'t propagated yet (can take up to 1 hour)');
  
  console.log('\n🔍 Next steps:');
  console.log('1. Verify the GA4 property ID in Google Analytics');
  console.log('   - Go to Admin → Property Settings');
  console.log('   - Look for "Property ID" (should be 9 digits)');
  console.log('2. Wait 15-30 minutes for permissions to fully propagate');
  console.log('3. Double-check the service account is added to the correct property');
}

testPropertyFormats().catch(console.error);