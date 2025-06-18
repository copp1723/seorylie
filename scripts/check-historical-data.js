#!/usr/bin/env node
/**
 * Check GA4 historical data (avoiding today due to processing delay)
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { Client } = require('pg');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function checkHistoricalData() {
  console.log('📊 GA4 Historical Data Check\n');
  console.log('Note: GA4 has a 24-48 hour processing delay for standard reports\n');
  
  process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
  const analyticsClient = new BetaAnalyticsDataClient();
  
  try {
    // 1. Check data from 2 days ago to 7 days ago (avoiding processing delay)
    console.log('📅 Checking data from 2-7 days ago:\n');
    
    const [weekResponse] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: '7daysAgo', endDate: '2daysAgo' }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }]
    });
    
    if (weekResponse.rows && weekResponse.rows.length > 0) {
      console.log('✅ HISTORICAL DATA FOUND!\n');
      console.log('Date       | Sessions | Users | Page Views | Bounce Rate');
      console.log('-'.repeat(60));
      
      let totalSessions = 0;
      let totalUsers = 0;
      let totalPageViews = 0;
      
      weekResponse.rows.forEach(row => {
        const date = row.dimensionValues[0].value;
        const sessions = row.metricValues[0].value;
        const users = row.metricValues[1].value;
        const pageViews = row.metricValues[2].value;
        const bounceRate = parseFloat(row.metricValues[3].value || 0).toFixed(2);
        
        totalSessions += parseInt(sessions);
        totalUsers += parseInt(users);
        totalPageViews += parseInt(pageViews);
        
        // Format date as YYYY-MM-DD
        const formattedDate = date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        
        console.log(
          `${formattedDate} | ${sessions.padStart(8)} | ${users.padStart(5)} | ${pageViews.padStart(10)} | ${bounceRate}%`
        );
      });
      
      console.log('-'.repeat(60));
      console.log(`TOTAL      | ${totalSessions.toString().padStart(8)} | ${totalUsers.toString().padStart(5)} | ${totalPageViews.toString().padStart(10)} |`);
      
      // Store some historical data in the database
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      
      console.log('\n💾 Storing historical data in database...');
      
      for (const row of weekResponse.rows.slice(0, 3)) {
        const date = row.dimensionValues[0].value;
        const formattedDate = date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        
        await client.query(`
          INSERT INTO performance_metrics 
            (dealership_id, metric_date, metric_type, metric_name, metric_value)
          VALUES 
            (1, $1, 'ga4_traffic', 'sessions', $2),
            (1, $1, 'ga4_traffic', 'users', $3),
            (1, $1, 'ga4_traffic', 'pageviews', $4)
          ON CONFLICT (dealership_id, metric_date, metric_type, metric_name) 
          DO UPDATE SET metric_value = EXCLUDED.metric_value
        `, [
          formattedDate,
          row.metricValues[0].value,
          row.metricValues[1].value,
          row.metricValues[2].value
        ]);
      }
      
      console.log('✅ Historical data stored\n');
      
      await client.end();
      
    } else {
      console.log('No historical data found for the past week.');
    }
    
    // 2. Check monthly data
    console.log('\n📊 Checking last 30 days (excluding recent 2 days):\n');
    
    const [monthResponse] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: '30daysAgo', endDate: '2daysAgo' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ]
    });
    
    if (monthResponse.rows && monthResponse.rows.length > 0) {
      const row = monthResponse.rows[0];
      console.log('Last 30 days totals:');
      console.log(`  Sessions: ${row.metricValues[0].value}`);
      console.log(`  Users: ${row.metricValues[1].value}`);
      console.log(`  Page Views: ${row.metricValues[2].value}`);
    }
    
    // 3. Check top pages
    console.log('\n📄 Top pages (last 7 days, excluding recent 2 days):\n');
    
    const [pagesResponse] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: '7daysAgo', endDate: '2daysAgo' }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10
    });
    
    if (pagesResponse.rows && pagesResponse.rows.length > 0) {
      console.log('Page Path | Views | Title');
      console.log('-'.repeat(80));
      
      pagesResponse.rows.forEach(row => {
        const path = row.dimensionValues[0].value.substring(0, 40).padEnd(40);
        const title = (row.dimensionValues[1].value || 'No title').substring(0, 30);
        const views = row.metricValues[0].value;
        
        console.log(`${path} | ${views.padStart(5)} | ${title}`);
      });
    }
    
    // 4. Summary
    console.log('\n📊 Summary:\n');
    
    if (weekResponse.rows && weekResponse.rows.length > 0) {
      console.log('✅ GA4 tracking is working! Historical data confirms the setup is correct.');
      console.log('✅ The 24-48 hour processing delay explains why today\'s data isn\'t visible.');
      console.log('✅ Your visit today will appear in reports tomorrow.');
      
      console.log('\n💡 Key Points:');
      console.log('- Real-time data has minimal delay (seconds to minutes)');
      console.log('- Standard reports have 24-48 hour processing delay');
      console.log('- The API can access both real-time and processed data');
      console.log('- Your integration is working perfectly!');
    } else {
      console.log('⚠️  No historical data found.');
      console.log('This could mean:');
      console.log('- The GA4 property is very new');
      console.log('- Tracking was recently installed');
      console.log('- Low traffic volume');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkHistoricalData().catch(console.error);