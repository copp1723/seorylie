#!/usr/bin/env node
/**
 * GA4 Setup Verification Script
 * Checks Google Analytics 4 API access and configuration
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

async function checkGA4Setup() {
  console.log('🔍 GA4 Setup Verification Starting...\n');
  
  // Check environment variables
  const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const DATABASE_URL = process.env.DATABASE_URL;
  
  console.log('📋 Environment Check:');
  console.log(`  DATABASE_URL: ${DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`  GOOGLE_APPLICATION_CREDENTIALS: ${CREDENTIALS_PATH ? '✅ Set' : '❌ Not set'}`);
  
  if (!CREDENTIALS_PATH) {
    console.error('\n❌ GOOGLE_APPLICATION_CREDENTIALS not set!');
    console.log('Set it to the path of your service account JSON file.');
    process.exit(1);
  }
  
  // Check if credentials file exists
  const fs = require('fs');
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`\n❌ Credentials file not found at: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }
  
  console.log(`\n📄 Credentials file found at: ${CREDENTIALS_PATH}`);
  
  try {
    // Read and parse credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    console.log('\n🔑 Service Account Info:');
    console.log(`  Project ID: ${credentials.project_id}`);
    console.log(`  Client Email: ${credentials.client_email}`);
    console.log(`  Client ID: ${credentials.client_id}`);
    
    // Initialize GA4 client
    console.log('\n🔄 Initializing GA4 Analytics Data Client...');
    const analyticsDataClient = new BetaAnalyticsDataClient();
    
    // Test with Jay Hatfield Chevrolet property
    const TEST_PROPERTY_ID = '320759942';
    console.log(`\n🏢 Testing with property: ${TEST_PROPERTY_ID} (Jay Hatfield Chevrolet)`);
    
    try {
      // Run a simple report to test access
      console.log('\n📊 Running test report...');
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${TEST_PROPERTY_ID}`,
        dateRanges: [
          {
            startDate: '7daysAgo',
            endDate: 'today',
          },
        ],
        dimensions: [
          {
            name: 'date',
          },
        ],
        metrics: [
          {
            name: 'sessions',
          },
        ],
        limit: 1,
      });
      
      console.log('✅ Successfully connected to GA4 API!');
      console.log(`\n📈 Sample data from last 7 days:`);
      
      if (response.rows && response.rows.length > 0) {
        response.rows.forEach(row => {
          const date = row.dimensionValues[0].value;
          const sessions = row.metricValues[0].value;
          console.log(`  ${date}: ${sessions} sessions`);
        });
      }
      
      // Check property metadata
      const [metadata] = await analyticsDataClient.getMetadata({
        name: `properties/${TEST_PROPERTY_ID}/metadata`,
      });
      
      console.log('\n📋 Available Metrics:');
      const sampleMetrics = metadata.metrics.slice(0, 5);
      sampleMetrics.forEach(metric => {
        console.log(`  - ${metric.apiName}: ${metric.uiName}`);
      });
      console.log(`  ... and ${metadata.metrics.length - 5} more`);
      
      console.log('\n✅ GA4 API access verified successfully!');
      
    } catch (apiError) {
      console.error('\n❌ GA4 API Error:', apiError.message);
      
      if (apiError.message.includes('403')) {
        console.log('\n🔍 Permission issue detected!');
        console.log('Make sure the service account has Viewer access to the GA4 property.');
        console.log(`\nTo grant access:`);
        console.log(`1. Go to Google Analytics`);
        console.log(`2. Admin → Property Access Management`);
        console.log(`3. Add user: ${credentials.client_email}`);
        console.log(`4. Role: Viewer`);
      }
    }
    
    // If database URL is set, check GA4 properties in database
    if (DATABASE_URL) {
      console.log('\n🔍 Checking GA4 properties in database...');
      
      const { Client } = require('pg');
      const client = new Client({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
      });
      
      try {
        await client.connect();
        
        const result = await client.query(`
          SELECT 
            property_id,
            property_name,
            measurement_id,
            website_url,
            is_active,
            sync_status,
            last_sync_at
          FROM ga4_properties
          ORDER BY property_name
        `);
        
        console.log(`\n📊 GA4 Properties in Database (${result.rows.length} total):`);
        result.rows.forEach(row => {
          console.log(`\n  Property: ${row.property_name || 'Unnamed'}`);
          console.log(`  ID: ${row.property_id}`);
          console.log(`  Measurement ID: ${row.measurement_id || 'Not set'}`);
          console.log(`  Website: ${row.website_url || 'Not set'}`);
          console.log(`  Active: ${row.is_active ? '✅' : '❌'}`);
          console.log(`  Sync Status: ${row.sync_status || 'Never synced'}`);
          console.log(`  Last Sync: ${row.last_sync_at || 'Never'}`);
        });
        
        await client.end();
      } catch (dbError) {
        console.error('Database error:', dbError.message);
      }
    }
    
    console.log('\n🎉 GA4 setup verification complete!');
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
    process.exit(1);
  }
}

// Run the check
checkGA4Setup().catch(console.error);