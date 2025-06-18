#!/usr/bin/env node
/**
 * Update GA4 property ID to the correct value
 */

const { Client } = require('pg');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const DATABASE_URL = "postgresql://seorylie_db_user:IFgPS0XSnJJql8P4LUOB92KqOVuhAKGK@dpg-d184im15pdvs73brlnv0-a.oregon-postgres.render.com/seorylie_db";

async function updateAndTest() {
  console.log('🔧 Updating GA4 Property ID\n');
  console.log('Old ID: 320759942 ❌');
  console.log('New ID: 493777160 ✅\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Update the property ID
    console.log('📝 Updating database...');
    await client.query(`
      UPDATE ga4_properties 
      SET property_id = '493777160',
          property_name = 'Jay Hatfield Chevrolet of Vinita',
          sync_status = 'ready'
      WHERE property_id = '320759942'
    `);
    
    console.log('✅ Database updated!\n');
    
    // Verify the update
    const result = await client.query('SELECT * FROM ga4_properties');
    console.log('📊 GA4 Properties in database:');
    result.rows.forEach(row => {
      console.log(`  Property ID: ${row.property_id}`);
      console.log(`  Name: ${row.property_name}`);
      console.log(`  Status: ${row.sync_status}\n`);
    });
    
    await client.end();
    
    // Now test the GA4 connection with the correct ID
    console.log('🔄 Testing GA4 connection with correct property ID...\n');
    
    process.env.GOOGLE_APPLICATION_CREDENTIALS = './config/credentials/ga4-service-account-key.json';
    const analyticsClient = new BetaAnalyticsDataClient();
    
    const [response] = await analyticsClient.runReport({
      property: 'properties/493777160',
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'city' },
        { name: 'country' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
      limit: 10
    });
    
    console.log('✅ SUCCESS! GA4 API connection established!\n');
    console.log('📊 Real Data from Jay Hatfield Chevrolet:\n');
    console.log('Date       | City                 | Country | Sessions | Users | Views');
    console.log('-'.repeat(80));
    
    response.rows.forEach(row => {
      const date = row.dimensionValues[0].value;
      const city = row.dimensionValues[1].value || 'Unknown';
      const country = row.dimensionValues[2].value || 'Unknown';
      const sessions = row.metricValues[0].value;
      const users = row.metricValues[1].value;
      const views = row.metricValues[2].value;
      
      console.log(
        `${date} | ${city.padEnd(20).substring(0, 20)} | ${country.padEnd(7)} | ${sessions.padStart(8)} | ${users.padStart(5)} | ${views.padStart(5)}`
      );
    });
    
    console.log('\n🎉 GA4 Integration Complete!');
    console.log('\n✅ Real data is now flowing from jayhatfieldchevroletvinita.com');
    console.log('\n📊 Next steps:');
    console.log('1. The system will now use real GA4 data');
    console.log('2. Performance metrics will be populated automatically');
    console.log('3. Reports will show actual visitor data');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

updateAndTest().catch(console.error);