#!/usr/bin/env tsx
/**
 * GA4 Service Account Setup Script for Rowdy's Properties
 * 
 * This script will:
 * 1. Create/verify the service account configuration
 * 2. Test access to the provided GA4 properties
 * 3. Generate setup instructions for Rowdy
 */

import { config } from 'dotenv';
import { createServiceAccountConfigFromEnv, createGA4ServiceAccountManager } from '../packages/ga4-service-manager/src';
import { GA4Client } from '../packages/ga4-reporter/src';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
config();

// Rowdy's test properties
const TEST_PROPERTIES = [
  {
    name: 'Jay Hatfield Chevrolet of Vinita',
    url: 'https://www.jayhatfieldchevroletvinita.com/',
    propertyId: '320759942',
    measurementId: 'G-ZJQKZZHVTM'
  },
  {
    name: 'Jay Hatfield Motorsports of Wichita',
    url: 'https://www.kansasmotorsports.com/',
    propertyId: '317592148',
    measurementId: 'G-DBMQEB1TM0'
  }
];

async function main() {
  console.log('🚀 GA4 Service Account Setup for Rowdy\'s Properties\n');

  try {
    // Step 1: Check environment configuration
    console.log('📋 Step 1: Checking environment configuration...');
    const requiredEnvVars = [
      'GA4_SERVICE_ACCOUNT_EMAIL',
      'GA4_PROJECT_ID',
      'GA4_PRIVATE_KEY',
      'GA4_KEY_ID',
      'GA4_ENCRYPTION_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => console.error(`   - ${varName}`));
      console.log('\n📝 Please add these to your .env file or environment');
      
      // Create a template .env.ga4 file
      await createEnvTemplate();
      console.log('📄 Created .env.ga4.template file with required variables');
      return;
    }

    console.log('✅ All required environment variables are set\n');

    // Step 2: Initialize service account manager
    console.log('📋 Step 2: Initializing service account manager...');
    const serviceAccountConfig = createServiceAccountConfigFromEnv();
    const ga4Manager = createGA4ServiceAccountManager(serviceAccountConfig);
    console.log('✅ Service account manager initialized\n');

    // Step 3: Test property access
    console.log('📋 Step 3: Testing access to GA4 properties...\n');
    
    for (const property of TEST_PROPERTIES) {
      console.log(`🔍 Testing: ${property.name}`);
      console.log(`   Property ID: ${property.propertyId}`);
      console.log(`   URL: ${property.url}`);
      
      try {
        // Test basic access
        const accessResult = await ga4Manager.testPropertyAccess(property.propertyId);
        
        if (accessResult.hasAccess) {
          console.log('   ✅ Access granted!');
          
          // Try to fetch a simple report
          const ga4Client = new GA4Client({
            propertyId: property.propertyId,
            credentials: serviceAccountConfig
          });
          
          // Get today's date range
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7); // Last 7 days
          
          const report = await ga4Client.getOverviewReport(startDate, endDate);
          console.log(`   📊 Successfully fetched overview report`);
          console.log(`      - Total Users: ${report.totalUsers.toLocaleString()}`);
          console.log(`      - Page Views: ${report.pageViews.toLocaleString()}`);
        } else {
          console.log('   ❌ No access - needs to be granted in GA4');
          console.log(`      Error: ${accessResult.error}`);
        }
      } catch (error) {
        console.log('   ❌ Error testing property:', error.message);
      }
      
      console.log('');
    }

    // Step 4: Generate setup instructions for Rowdy
    console.log('📋 Step 4: Generating setup instructions...\n');
    await generateSetupInstructions();
    console.log('✅ Setup instructions saved to: docs/GA4_SETUP_INSTRUCTIONS_FOR_ROWDY.md\n');

    // Step 5: Display service account email
    console.log('🔑 Service Account Email (share this with Rowdy):');
    console.log(`   ${process.env.GA4_SERVICE_ACCOUNT_EMAIL}\n`);
    
    console.log('✨ Setup complete! Next steps:');
    console.log('1. Share the service account email with Rowdy');
    console.log('2. Have Rowdy add this email as a Viewer to each GA4 property');
    console.log('3. Run this script again to verify access after permissions are granted');

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

async function createEnvTemplate() {
  const template = `# GA4 Service Account Configuration
# Copy this to .env and fill in your values

# Service Account Email (from JSON key file)
GA4_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Google Cloud Project ID
GA4_PROJECT_ID=your-google-cloud-project-id

# Private Key (from JSON key file - include quotes and \\n)
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n"

# Key ID (from JSON key file)
GA4_KEY_ID=your-key-id-here

# Encryption key for storing credentials (minimum 32 characters)
GA4_ENCRYPTION_KEY=your-32-character-or-longer-encryption-key-here

# Optional: Path to service account JSON file
# GA4_SERVICE_ACCOUNT_KEY_PATH=./config/credentials/ga4-service-account-key.json

# API Quota Limits (optional)
GA4_DAILY_QUOTA_LIMIT=100000
GA4_HOURLY_QUOTA_LIMIT=10000
`;

  await fs.writeFile('.env.ga4.template', template);
}

async function generateSetupInstructions() {
  const instructions = `# GA4 Setup Instructions for Rowdy

## Service Account Email
\`\`\`
${process.env.GA4_SERVICE_ACCOUNT_EMAIL}
\`\`\`

## How to Grant Access to Your GA4 Properties

### For Each Property:

1. **Go to Google Analytics**
   - Visit [analytics.google.com](https://analytics.google.com)
   - Make sure you're logged in with an account that has admin access

2. **Select the Property**
   - Use the property selector at the top to choose the correct property
   - Property IDs for reference:
     - Jay Hatfield Chevrolet of Vinita: 320759942
     - Jay Hatfield Motorsports of Wichita: 317592148

3. **Navigate to Property Access**
   - Click the gear icon (⚙️) at the bottom left for "Admin"
   - In the "Property" column, click "Property Access Management"

4. **Add the Service Account**
   - Click the "+" button in the top right
   - Click "Add users"
   - Enter the service account email: \`${process.env.GA4_SERVICE_ACCOUNT_EMAIL}\`
   - Set the role to "Viewer" (this is sufficient for reporting)
   - Click "Add"

5. **Verify Access**
   - The service account should now appear in the list of users
   - Status should show as "Active"

## Testing the Connection

Once you've added the service account to your properties, we'll run a test to verify:
- The service account can connect to your GA4 properties
- We can retrieve basic analytics data
- All permissions are set correctly

## Security Notes

- The service account only has "Viewer" access - it cannot modify your GA4 settings
- All data is transmitted securely using Google's API
- Credentials are encrypted when stored in our system
- We follow Google's best practices for service account security

## Need Help?

If you encounter any issues:
1. Double-check the service account email is entered correctly
2. Ensure you have admin access to the GA4 property
3. Try removing and re-adding the service account if needed

Last generated: ${new Date().toISOString()}
`;

  const docsDir = path.join(process.cwd(), 'docs');
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, 'GA4_SETUP_INSTRUCTIONS_FOR_ROWDY.md'), instructions);
}

// Run the script
main().catch(console.error);