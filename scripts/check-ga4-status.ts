import * as dotenv from 'dotenv';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function checkGA4Status() {
  console.log(`${colors.blue}🔍 GA4 Integration Status Check${colors.reset}\n`);
  
  // 1. Check environment variables
  console.log(`${colors.yellow}1. Environment Configuration:${colors.reset}`);
  
  const requiredEnvVars = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GA4_KEY_FILE_PATH',
    'GA4_SERVICE_ACCOUNT_EMAIL',
    'DATABASE_URL'
  ];
  
  let allEnvVarsSet = true;
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`${colors.green}✅${colors.reset} ${envVar}: ${envVar.includes('KEY') ? '***' : value}`);
    } else {
      console.log(`${colors.red}❌${colors.reset} ${envVar}: Not set`);
      allEnvVarsSet = false;
    }
  }
  
  // 2. Check service account file
  console.log(`\n${colors.yellow}2. Service Account File:${colors.reset}`);
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (credPath && fs.existsSync(credPath)) {
    console.log(`${colors.green}✅${colors.reset} File exists at: ${credPath}`);
    
    try {
      const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      console.log(`${colors.green}✅${colors.reset} Project ID: ${credentials.project_id}`);
      console.log(`${colors.green}✅${colors.reset} Client Email: ${credentials.client_email}`);
    } catch (error) {
      console.log(`${colors.red}❌${colors.reset} Failed to parse credentials file`);
    }
  } else {
    console.log(`${colors.red}❌${colors.reset} Service account file not found`);
  }
  
  // 3. Test GA4 API connection
  console.log(`\n${colors.yellow}3. GA4 API Connection Test:${colors.reset}`);
  
  if (!allEnvVarsSet || !credPath || !fs.existsSync(credPath)) {
    console.log(`${colors.red}❌${colors.reset} Cannot test API - missing configuration`);
    return;
  }
  
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient();
    console.log(`${colors.green}✅${colors.reset} GA4 client initialized successfully`);
    
    // Test with a known property ID (you mentioned you have one hooked up)
    const testPropertyId = '320759942'; // Replace with your actual property ID
    console.log(`\n${colors.yellow}4. Testing Property Access:${colors.reset}`);
    console.log(`Testing property ID: ${testPropertyId}`);
    
    try {
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${testPropertyId}`,
        dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
        metrics: [{ name: 'sessions' }]
      });
      
      console.log(`${colors.green}✅${colors.reset} Successfully accessed GA4 property!`);
      console.log(`${colors.green}✅${colors.reset} Data rows returned: ${response.rows?.length || 0}`);
      
      if (response.rows && response.rows.length > 0) {
        const sessions = response.rows[0].metricValues?.[0]?.value || '0';
        console.log(`${colors.green}✅${colors.reset} Yesterday's sessions: ${sessions}`);
      }
    } catch (error: any) {
      console.log(`${colors.red}❌${colors.reset} Failed to access property: ${error.message}`);
      console.log(`\n${colors.yellow}Common issues:${colors.reset}`);
      console.log('1. Service account needs Viewer access to the GA4 property');
      console.log('2. GA4 Data API needs to be enabled in Google Cloud Console');
      console.log('3. Property ID might be incorrect');
    }
    
  } catch (error: any) {
    console.log(`${colors.red}❌${colors.reset} Failed to initialize GA4 client: ${error.message}`);
  }
  
  // 5. Next steps
  console.log(`\n${colors.yellow}5. Next Steps:${colors.reset}`);
  if (allEnvVarsSet) {
    console.log(`${colors.green}✅${colors.reset} Environment is configured correctly`);
    console.log('\nTo connect real dealership data:');
    console.log('1. Run: npm run setup:real-ga4');
    console.log('2. Enter GA4 property IDs for each dealership');
    console.log('3. Grant service account access to each property');
  } else {
    console.log(`${colors.red}❌${colors.reset} Please configure missing environment variables first`);
  }
}

// Run the check
checkGA4Status()
  .then(() => {
    console.log(`\n${colors.blue}Check complete!${colors.reset}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, err);
    process.exit(1);
  });