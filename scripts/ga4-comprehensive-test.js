#!/usr/bin/env node
/**
 * Comprehensive GA4 data test with the correct property ID
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { Client } = require('pg');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function comprehensiveTest() {
  console.log('🎉 GA4 Integration Successful Test\n');
  console.log('Property ID: 493777160 (Jay Hatfield Chevrolet)\n');
  
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
  const analyticsClient = new BetaAnalyticsDataClient();
  
  try {
    // Test 1: Get data for different date ranges
    console.log('📅 Testing different date ranges:\n');
    
    const dateRanges = [
      { start: '1daysAgo', end: 'today', label: 'Today' },
      { start: '7daysAgo', end: 'today', label: 'Last 7 days' },
      { start: '30daysAgo', end: 'today', label: 'Last 30 days' },
      { start: '90daysAgo', end: 'today', label: 'Last 90 days' }
    ];
    
    for (const range of dateRanges) {
      const [response] = await analyticsClient.runReport({
        property: 'properties/493777160',
        dateRanges: [{ startDate: range.start, endDate: range.end }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' }
        ]
      });
      
      if (response.rows && response.rows.length > 0) {
        const row = response.rows[0];
        console.log(`${range.label}:`);
        console.log(`  Sessions: ${row.metricValues[0].value}`);
        console.log(`  Users: ${row.metricValues[1].value}`);
        console.log(`  Page Views: ${row.metricValues[2].value}\n`);
      } else {
        console.log(`${range.label}: No data available\n`);
      }
    }
    
    // Test 2: Get available dimensions and metrics
    console.log('📊 Getting property metadata:\n');
    
    const [metadata] = await analyticsClient.getMetadata({
      name: 'properties/493777160/metadata'
    });
    
    console.log('Available dimensions:', metadata.dimensions.length);
    console.log('Sample dimensions:');
    metadata.dimensions.slice(0, 5).forEach(dim => {
      console.log(`  - ${dim.apiName}: ${dim.uiName}`);
    });
    
    console.log('\nAvailable metrics:', metadata.metrics.length);
    console.log('Sample metrics:');
    metadata.metrics.slice(0, 5).forEach(metric => {
      console.log(`  - ${metric.apiName}: ${metric.uiName}`);
    });
    
    // Test 3: Try to get some data with broader date range
    console.log('\n📈 Checking for any historical data:\n');
    
    const [historicalData] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'month' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 12
    });
    
    if (historicalData.rows && historicalData.rows.length > 0) {
      console.log('Monthly data found:');
      historicalData.rows.forEach(row => {
        const month = row.dimensionValues[0].value;
        const sessions = row.metricValues[0].value;
        if (parseInt(sessions) > 0) {
          console.log(`  ${month}: ${sessions} sessions`);
        }
      });
    } else {
      console.log('No historical data found.');
    }
    
    // Store test data in database
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    // Update sync status
    await client.query(`
      UPDATE ga4_properties 
      SET sync_status = 'connected',
          last_sync_at = CURRENT_TIMESTAMP,
          property_name = 'Jay Hatfield Chevrolet of Vinita (Connected)'
      WHERE property_id = '493777160'
    `);
    
    console.log('\n✅ Database updated with connection status');
    
    await client.end();
    
    console.log('\n🎉 GA4 INTEGRATION COMPLETE!');
    console.log('\n📋 Summary:');
    console.log('- API Connection: ✅ Working');
    console.log('- Property Access: ✅ Granted');
    console.log('- Property ID: ✅ 493777160');
    console.log('- Database: ✅ Updated');
    
    console.log('\n💡 Note: If no data is showing, it could mean:');
    console.log('1. The GA4 property is newly created');
    console.log('2. The tracking code isn\'t installed on the website yet');
    console.log('3. There hasn\'t been any traffic recently');
    
    console.log('\n🔧 To verify tracking is working:');
    console.log('1. Visit https://www.jayhatfieldchevroletvinita.com');
    console.log('2. Check GA4 Realtime reports');
    console.log('3. Look for your visit in the data');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

comprehensiveTest().catch(console.error);