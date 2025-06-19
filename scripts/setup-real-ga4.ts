import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

interface DealershipGA4Setup {
  dealershipId: string;
  dealershipName: string;
  ga4PropertyId: string;
  websiteUrl: string;
}

async function verifyGA4Access(propertyId: string): Promise<boolean> {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient();
    
    // Try to fetch basic property metadata
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
      metrics: [{ name: 'sessions' }]
    });
    
    console.log(`✅ Successfully verified access to property ${propertyId}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Cannot access property ${propertyId}:`, error.message);
    return false;
  }
}

async function setupDealershipGA4(setup: DealershipGA4Setup) {
  console.log(`\n🔧 Setting up GA4 for ${setup.dealershipName}...`);
  
  // 1. Verify we can access the GA4 property
  const hasAccess = await verifyGA4Access(setup.ga4PropertyId);
  if (!hasAccess) {
    console.error(`\n⚠️  Cannot proceed without GA4 access.`);
    console.error(`\nPlease grant viewer access to your service account:`);
    console.error(`Service Account: ${process.env.GA4_SERVICE_ACCOUNT_EMAIL}`);
    console.error(`GA4 Property ID: ${setup.ga4PropertyId}`);
    return false;
  }
  
  // 2. Update dealership with GA4 property ID
  try {
    const updateQuery = `
      UPDATE dealerships 
      SET 
        ga4_property_id = $1,
        ga4_connected = $2,
        ga4_connected_at = $3
      WHERE id = $4
    `;
    
    await pool.query(updateQuery, [
      setup.ga4PropertyId,
      true,
      new Date().toISOString(),
      setup.dealershipId
    ]);
  } catch (updateError) {
    console.error('❌ Failed to update dealership:', updateError);
    return false;
  }
  
  // 3. Store property configuration
  try {
    const upsertQuery = `
      INSERT INTO ga4_properties (
        dealership_id, property_id, property_name, website_url,
        is_active, last_sync, configuration
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (dealership_id) 
      DO UPDATE SET
        property_id = EXCLUDED.property_id,
        property_name = EXCLUDED.property_name,
        website_url = EXCLUDED.website_url,
        is_active = EXCLUDED.is_active,
        last_sync = EXCLUDED.last_sync,
        configuration = EXCLUDED.configuration
    `;
    
    await pool.query(upsertQuery, [
      setup.dealershipId,
      setup.ga4PropertyId,
      setup.dealershipName,
      setup.websiteUrl,
      true,
      new Date().toISOString(),
      JSON.stringify({
        tracking_enabled: true,
        conversion_events: ['form_submit', 'phone_call', 'chat_started'],
        custom_dimensions: ['vehicle_type', 'vehicle_make', 'vehicle_model']
      })
    ]);
  } catch (propertyError) {
    console.error('❌ Failed to store GA4 property:', propertyError);
    return false;
  }
  
  // 4. Test data fetch
  console.log('\n📊 Testing data fetch...');
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient();
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${setup.ga4PropertyId}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
      metrics: [
        { name: 'sessions' },
        { name: 'users' },
        { name: 'pageviews' },
        { name: 'conversions' }
      ],
      dimensions: [{ name: 'date' }]
    });
    
    console.log('\n✅ Successfully fetched GA4 data:');
    console.log(`- Rows returned: ${response.rows?.length || 0}`);
    if (response.rows && response.rows.length > 0) {
      const totals = response.rows.reduce((acc, row) => {
        acc.sessions += parseInt(row.metricValues?.[0]?.value || '0');
        acc.users += parseInt(row.metricValues?.[1]?.value || '0');
        acc.pageviews += parseInt(row.metricValues?.[2]?.value || '0');
        acc.conversions += parseInt(row.metricValues?.[3]?.value || '0');
        return acc;
      }, { sessions: 0, users: 0, pageviews: 0, conversions: 0 });
      
      console.log(`- Total Sessions: ${totals.sessions}`);
      console.log(`- Total Users: ${totals.users}`);
      console.log(`- Total Pageviews: ${totals.pageviews}`);
      console.log(`- Total Conversions: ${totals.conversions}`);
    }
  } catch (error) {
    console.error('❌ Failed to fetch test data:', error);
    return false;
  }
  
  console.log(`\n✅ GA4 setup complete for ${setup.dealershipName}!`);
  return true;
}

// Main setup function
async function setupRealGA4Data() {
  console.log('🚀 Setting up REAL GA4 data for alpha dealerships\n');
  
  // Check environment
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('❌ Missing GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.error('Please set the path to your service account JSON file');
    process.exit(1);
  }
  
  if (!process.env.GA4_SERVICE_ACCOUNT_EMAIL) {
    console.error('⚠️  GA4_SERVICE_ACCOUNT_EMAIL not set');
    console.error('This is needed for instructions but not critical');
  }
  
  // Get dealerships from database
  let dealerships;
  try {
    const { rows } = await pool.query(`
      SELECT * FROM dealerships 
      ORDER BY created_at ASC
    `);
    dealerships = rows;
  } catch (error) {
    console.error('❌ Failed to fetch dealerships:', error);
    process.exit(1);
  }
  
  if (!dealerships || dealerships.length === 0) {
    console.error('❌ No dealerships found');
    process.exit(1);
  }
  
  console.log(`Found ${dealerships.length} dealerships\n`);
  
  // Prompt for GA4 property IDs
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      readline.question(prompt, resolve);
    });
  };
  
  for (const dealership of dealerships) {
    console.log(`\n📍 ${dealership.name} (${dealership.location})`);
    
    if (dealership.ga4_property_id && dealership.ga4_connected) {
      console.log(`✅ Already connected to GA4 property: ${dealership.ga4_property_id}`);
      const reconnect = await question('Reconnect? (y/N): ');
      if (reconnect.toLowerCase() !== 'y') continue;
    }
    
    const propertyId = await question(`Enter GA4 Property ID (or 'skip'): `);
    
    if (propertyId.toLowerCase() === 'skip') {
      console.log('⏭️  Skipping...');
      continue;
    }
    
    await setupDealershipGA4({
      dealershipId: dealership.id,
      dealershipName: dealership.name,
      ga4PropertyId: propertyId.trim(),
      websiteUrl: dealership.website || ''
    });
  }
  
  readline.close();
  
  console.log('\n✅ GA4 setup process complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Ensure all dealerships have granted viewer access to your service account');
  console.log('2. Configure conversion events in each GA4 property');
  console.log('3. Set up custom dimensions for vehicle-specific tracking');
  console.log('4. Test the analytics dashboard with real data');
}

// Run the setup
if (require.main === module) {
  setupRealGA4Data()
    .then(() => {
      pool.end();
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      pool.end();
      process.exit(1);
    });
}

export { setupDealershipGA4, verifyGA4Access };