#!/usr/bin/env node
/**
 * Enhanced GA4 real-time check with debugging
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { Client } = require('pg');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function enhancedRealtimeCheck() {
  console.log('🔍 Enhanced GA4 Real-time Check\n');
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log('Property ID: 493777160');
  console.log('Website: jayhatfieldchevroletvinita.com\n');
  
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
  const analyticsClient = new BetaAnalyticsDataClient();
  
  try {
    // 1. Check real-time data with more detail
    console.log('📊 Checking real-time data (last 30 minutes):\n');
    
    const [realtimeResponse] = await analyticsClient.runRealtimeReport({
      property: 'properties/493777160',
      dimensions: [
        { name: 'country' },
        { name: 'city' },
        { name: 'deviceCategory' },
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'eventCount' }
      ],
      limit: 20
    });
    
    if (realtimeResponse.rows && realtimeResponse.rows.length > 0) {
      console.log('✅ VISITOR DETECTED!\n');
      
      realtimeResponse.rows.forEach((row, index) => {
        console.log(`Visitor ${index + 1}:`);
        console.log(`  Location: ${row.dimensionValues[1].value || 'Unknown'}, ${row.dimensionValues[0].value}`);
        console.log(`  Device: ${row.dimensionValues[2].value}`);
        console.log(`  Page: ${row.dimensionValues[3].value}`);
        console.log(`  Title: ${row.dimensionValues[4].value || 'No title'}`);
        console.log(`  Active Users: ${row.metricValues[0].value}`);
        console.log(`  Page Views: ${row.metricValues[1].value}`);
        console.log(`  Events: ${row.metricValues[2].value}`);
        console.log('');
      });
    } else {
      console.log('No real-time visitors detected yet.\n');
    }
    
    // 2. Check minute-by-minute data for last hour
    console.log('📈 Checking activity by minute (last 60 minutes):\n');
    
    const [minuteResponse] = await analyticsClient.runRealtimeReport({
      property: 'properties/493777160',
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }],
      limit: 60
    });
    
    let hasActivity = false;
    if (minuteResponse.rows && minuteResponse.rows.length > 0) {
      console.log('Minutes Ago | Users | Views');
      console.log('-'.repeat(30));
      
      minuteResponse.rows.forEach(row => {
        const minutes = row.dimensionValues[0].value;
        const users = row.metricValues[0].value;
        const views = row.metricValues[1].value;
        
        if (parseInt(users) > 0 || parseInt(views) > 0) {
          hasActivity = true;
          console.log(`${minutes.padStart(11)} | ${users.padStart(5)} | ${views.padStart(5)}`);
        }
      });
      
      if (!hasActivity) {
        console.log('No activity in the last 60 minutes.');
      }
    }
    
    // 3. Check event data
    console.log('\n🎯 Checking recent events:\n');
    
    const [eventResponse] = await analyticsClient.runRealtimeReport({
      property: 'properties/493777160',
      dimensions: [
        { name: 'eventName' },
        { name: 'minutesAgo' }
      ],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }],
      limit: 20
    });
    
    if (eventResponse.rows && eventResponse.rows.length > 0) {
      console.log('Event Name            | Minutes Ago | Count');
      console.log('-'.repeat(45));
      
      eventResponse.rows.forEach(row => {
        const event = row.dimensionValues[0].value.substring(0, 20).padEnd(20);
        const minutes = row.dimensionValues[1].value;
        const count = row.metricValues[0].value;
        
        console.log(`${event} | ${minutes.padStart(11)} | ${count.padStart(5)}`);
      });
    } else {
      console.log('No events recorded yet.');
    }
    
    // 4. Get measurement ID from database
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    const result = await client.query('SELECT measurement_id FROM ga4_properties WHERE property_id = $1', ['493777160']);
    const measurementId = result.rows[0]?.measurement_id;
    await client.end();
    
    // 5. Diagnosis
    console.log('\n🔍 Diagnostic Information:\n');
    console.log(`Property ID: 493777160 ✅`);
    console.log(`Measurement ID: ${measurementId || 'Not set in database'}`);
    console.log(`API Connection: Working ✅`);
    console.log(`Current Time: ${new Date().toLocaleString()}`);
    
    if (!hasActivity && (!realtimeResponse.rows || realtimeResponse.rows.length === 0)) {
      console.log('\n⚠️  No data detected from your visit yet.\n');
      console.log('Possible reasons:');
      console.log('1. GTM container might need to be published');
      console.log('2. GA4 tag might not be firing properly');
      console.log('3. There might be a delay in data processing (usually instant)');
      console.log('4. Browser ad blockers might be preventing tracking');
      
      console.log('\n🔧 Troubleshooting steps:');
      console.log('1. Check GA4 Real-time reports in the GA4 interface');
      console.log('2. Use Google Tag Assistant to verify tag firing');
      console.log('3. Check browser console for GTM/GA4 errors');
      console.log('4. Ensure GTM container is published with GA4 tag');
    } else {
      console.log('\n✅ Data is flowing! Your visit was tracked successfully.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

enhancedRealtimeCheck().catch(console.error);