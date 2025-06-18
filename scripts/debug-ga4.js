#!/usr/bin/env node
/**
 * Debug GA4 connection issues
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');

async function debugGA4() {
  console.log('🔍 GA4 Connection Debugging\n');
  console.log('=' . repeat(50) + '\n');
  
  // Check credentials
  const credPath = './config/credentials/ga4-service-account-key.json';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  
  if (!fs.existsSync(credPath)) {
    console.error('❌ Credentials file not found!');
    return;
  }
  
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  console.log('📋 Service Account Details:');
  console.log(`  Email: ${creds.client_email}`);
  console.log(`  Project: ${creds.project_id}`);
  console.log(`  Key ID: ${creds.private_key_id.substring(0, 8)}...`);
  
  // Initialize client
  const analyticsDataClient = new BetaAnalyticsDataClient();
  
  // The property ID from the screenshot
  const propertyId = '320759942';
  
  console.log(`\n🏢 Testing Property: ${propertyId}`);
  console.log('  This should be Jay Hatfield Chevrolet\n');
  
  try {
    // Try a minimal query
    console.log('📊 Running minimal test query...\n');
    
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
      metrics: [{ name: 'sessions' }],
      limit: 1
    });
    
    console.log('✅ SUCCESS! Connection established!\n');
    
    if (response.rows && response.rows.length > 0) {
      console.log(`Sessions yesterday: ${response.rows[0].metricValues[0].value}`);
    }
    
    // If successful, run a more detailed query
    console.log('\n📊 Running detailed query...\n');
    
    const [detailedResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'country' },
        { name: 'city' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
      limit: 5
    });
    
    console.log('✅ Detailed query successful!\n');
    console.log('📊 Sample Data from Jay Hatfield Chevrolet:');
    console.log('Date       | Location              | Sessions | Users | Views');
    console.log('-'.repeat(70));
    
    detailedResponse.rows.forEach(row => {
      const date = row.dimensionValues[0].value;
      const country = row.dimensionValues[1].value;
      const city = row.dimensionValues[2].value;
      const location = `${city}, ${country}`.substring(0, 20);
      const sessions = row.metricValues[0].value;
      const users = row.metricValues[1].value;
      const views = row.metricValues[2].value;
      
      console.log(
        `${date} | ${location.padEnd(20)} | ${sessions.padStart(8)} | ${users.padStart(5)} | ${views.padStart(5)}`
      );
    });
    
    console.log('\n✅ GA4 integration is working perfectly!');
    console.log('\n🎉 Real data from Jay Hatfield Chevrolet is accessible!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 7) {
      console.log('\n🔍 Permission Error Details:');
      console.log('  - Service account has Viewer access (confirmed in screenshot)');
      console.log('  - Property ID is correct: 320759942');
      console.log('\n📋 Possible causes:');
      console.log('  1. Permissions may take up to 5 minutes to propagate');
      console.log('  2. The Google Analytics Data API might not be enabled');
      console.log('  3. There might be a project mismatch');
      
      console.log('\n🔧 To enable the API:');
      console.log('  1. Go to: https://console.cloud.google.com/apis/library');
      console.log('  2. Search for "Google Analytics Data API"');
      console.log('  3. Select it and click "Enable"');
      console.log(`  4. Make sure you're in project: ${creds.project_id}`);
    }
  }
}

debugGA4().catch(console.error);