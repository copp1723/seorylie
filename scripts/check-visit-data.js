#!/usr/bin/env node
/**
 * Check GA4 real-time and today's data
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

async function checkGA4Data() {
  console.log('🔍 GA4 Data Check After Your Visit\n');
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log('Property: Jay Hatfield Chevrolet (493777160)\n');
  
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
  const analyticsClient = new BetaAnalyticsDataClient();
  
  try {
    // 1. Simple real-time check
    console.log('📊 Checking for recent activity:\n');
    
    try {
      const [realtimeResponse] = await analyticsClient.runRealtimeReport({
        property: 'properties/493777160',
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }]
      });
      
      if (realtimeResponse.rows && realtimeResponse.rows.length > 0) {
        console.log('✅ ACTIVE VISITORS DETECTED!\n');
        realtimeResponse.rows.forEach(row => {
          console.log(`  ${row.dimensionValues[0].value}: ${row.metricValues[0].value} active users`);
        });
      } else {
        console.log('No active visitors in real-time report.');
      }
    } catch (rtError) {
      console.log('Real-time report error:', rtError.message);
    }
    
    // 2. Check today's data
    console.log('\n📅 Checking today\'s data:\n');
    
    const [todayResponse] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'eventCount' }
      ]
    });
    
    if (todayResponse.rows && todayResponse.rows.length > 0) {
      const row = todayResponse.rows[0];
      console.log('✅ Today\'s statistics:');
      console.log(`  Sessions: ${row.metricValues[0].value}`);
      console.log(`  Users: ${row.metricValues[1].value}`);
      console.log(`  Page Views: ${row.metricValues[2].value}`);
      console.log(`  Events: ${row.metricValues[3].value}`);
      
      if (parseInt(row.metricValues[0].value) > 0) {
        console.log('\n🎉 Your visit was tracked successfully!');
      }
    } else {
      console.log('No data for today yet.');
    }
    
    // 3. Check yesterday's data for comparison
    console.log('\n📊 Checking yesterday\'s data for comparison:\n');
    
    const [yesterdayResponse] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ]
    });
    
    if (yesterdayResponse.rows && yesterdayResponse.rows.length > 0) {
      const row = yesterdayResponse.rows[0];
      console.log('Yesterday\'s statistics:');
      console.log(`  Sessions: ${row.metricValues[0].value}`);
      console.log(`  Users: ${row.metricValues[1].value}`);
      console.log(`  Page Views: ${row.metricValues[2].value}`);
    } else {
      console.log('No data for yesterday.');
    }
    
    // 4. Get page data if available
    console.log('\n📄 Checking page visits:\n');
    
    const [pageResponse] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10
    });
    
    if (pageResponse.rows && pageResponse.rows.length > 0) {
      console.log('Pages visited today:');
      pageResponse.rows.forEach(row => {
        const path = row.dimensionValues[0].value;
        const title = row.dimensionValues[1].value || 'No title';
        const views = row.metricValues[0].value;
        console.log(`  ${path} - ${views} views`);
        console.log(`    Title: ${title}`);
      });
    } else {
      console.log('No page data available yet.');
    }
    
    // 5. Diagnosis
    console.log('\n🔍 Status Summary:\n');
    
    const hasData = todayResponse.rows && 
                   todayResponse.rows.length > 0 && 
                   parseInt(todayResponse.rows[0].metricValues[0].value) > 0;
    
    if (hasData) {
      console.log('✅ GA4 tracking is working! Your visit was recorded.');
      console.log('✅ Data is flowing into the system.');
    } else {
      console.log('⏳ No data detected yet from your visit.\n');
      console.log('This could mean:');
      console.log('1. There\'s a delay in data processing (can take 5-30 minutes)');
      console.log('2. GTM container needs to be published');
      console.log('3. GA4 configuration needs to be checked');
      
      console.log('\n💡 Next steps:');
      console.log('1. Check GA4 Real-time reports in the GA4 interface');
      console.log('2. Verify GTM container is published');
      console.log('3. Try visiting the site again in a few minutes');
      console.log('4. Run this script again in 10-15 minutes');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkGA4Data().catch(console.error);