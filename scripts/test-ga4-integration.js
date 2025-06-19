#!/usr/bin/env node
/**
 * Fix GA4 properties table and test GA4 connection
 */

const { Client } = require('pg');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function testGA4Integration() {
  console.log('🚀 GA4 Real Data Integration Test\n');
  console.log('=' . repeat(50) + '\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Database connected\n');
    
    // Check GA4 properties
    console.log('📊 GA4 Properties in Database:');
    const ga4Result = await client.query(`
      SELECT 
        property_id,
        property_name,
        measurement_id,
        website_url,
        is_active,
        sync_status,
        last_sync_at
      FROM ga4_properties
    `);
    
    ga4Result.rows.forEach(row => {
      console.log(`\n  Property ID: ${row.property_id}`);
      console.log(`  Name: ${row.property_name || 'Jay Hatfield Chevrolet'}`);
      console.log(`  Website: ${row.website_url || 'https://www.jayhatfieldchevroletvinita.com'}`);
      console.log(`  Active: ${row.is_active ? '✅' : '❌'}`);
      console.log(`  Sync Status: ${row.sync_status || 'Ready'}`);
    });
    
    // Test GA4 API
    console.log('\n\n🔄 Testing GA4 API Connection...\n');
    
    // Set up credentials
    process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
    
    const analyticsDataClient = new BetaAnalyticsDataClient();
    const propertyId = '320759942'; // Jay Hatfield Chevrolet
    
    console.log(`📍 Testing property: ${propertyId}`);
    console.log('📅 Date range: Last 7 days\n');
    
    // Run a real data query
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: '7daysAgo',
          endDate: 'today',
        },
      ],
      dimensions: [
        { name: 'date' },
        { name: 'city' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
      ],
      orderBys: [
        {
          dimension: { dimensionName: 'date' },
          desc: true,
        },
      ],
      limit: 10,
    });
    
    console.log('✅ GA4 API Connection Successful!\n');
    console.log('📊 Real Data from Jay Hatfield Chevrolet:\n');
    
    if (response.rows && response.rows.length > 0) {
      console.log('Date       | City            | Sessions | Users | Page Views');
      console.log('-'.repeat(60));
      
      response.rows.forEach(row => {
        const date = row.dimensionValues[0].value;
        const city = row.dimensionValues[1].value || 'Unknown';
        const sessions = row.metricValues[0].value;
        const users = row.metricValues[1].value;
        const pageViews = row.metricValues[2].value;
        
        console.log(
          `${date} | ${city.padEnd(15)} | ${sessions.padStart(8)} | ${users.padStart(5)} | ${pageViews.padStart(10)}`
        );
      });
      
      // Store sample data in performance_metrics
      console.log('\n\n💾 Storing sample data in performance_metrics...');
      
      for (const row of response.rows.slice(0, 3)) {
        const date = row.dimensionValues[0].value;
        const city = row.dimensionValues[1].value || 'Unknown';
        
        await client.query(`
          INSERT INTO performance_metrics 
            (dealership_id, metric_date, metric_type, metric_name, metric_value, dimension_values)
          VALUES 
            (1, $1, 'ga4_traffic', 'sessions', $2, $3)
          ON CONFLICT DO NOTHING
        `, [
          date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
          row.metricValues[0].value,
          JSON.stringify({ city })
        ]);
      }
      
      console.log('✅ Sample data stored\n');
    }
    
    // Get available metrics
    console.log('\n📋 Available GA4 Metrics:');
    const [metadata] = await analyticsDataClient.getMetadata({
      name: `properties/${propertyId}/metadata`,
    });
    
    console.log('\nTraffic Metrics:');
    ['sessions', 'activeUsers', 'newUsers', 'bounceRate', 'screenPageViews']
      .forEach(metric => {
        const m = metadata.metrics.find(x => x.apiName === metric);
        if (m) console.log(`  - ${m.apiName}: ${m.uiName}`);
      });
    
    console.log('\nEngagement Metrics:');
    ['averageSessionDuration', 'screenPageViewsPerSession', 'engagementRate']
      .forEach(metric => {
        const m = metadata.metrics.find(x => x.apiName === metric);
        if (m) console.log(`  - ${m.apiName}: ${m.uiName}`);
      });
    
    // Update sync status
    await client.query(`
      UPDATE ga4_properties 
      SET sync_status = 'connected',
          last_sync_at = CURRENT_TIMESTAMP
      WHERE property_id = $1
    `, [propertyId]);
    
    console.log('\n\n✅ GA4 Integration Test Complete!');
    console.log('\n🎉 Real data is now flowing from Jay Hatfield Chevrolet!');
    console.log('\nNext steps:');
    console.log('1. Check performance_metrics table for stored data');
    console.log('2. Run full data sync with: npm run sync:ga4');
    console.log('3. View dashboard at: http://localhost:3000/dashboard\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('403')) {
      console.log('\n🔐 Permission Issue!');
      console.log('The service account needs access to the GA4 property.');
      console.log('\nTo fix:');
      console.log('1. Go to Google Analytics');
      console.log('2. Admin → Property Access Management');
      console.log('3. Add: seo-ga4-service@onekeel-seo.iam.gserviceaccount.com');
      console.log('4. Role: Viewer\n');
    }
  } finally {
    await client.end();
  }
}

// Run test
testGA4Integration().catch(console.error);