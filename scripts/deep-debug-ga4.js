#!/usr/bin/env node
/**
 * Deep debug GA4 connection issues
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');

async function deepDebug() {
  console.log('🔍 Deep GA4 Debugging\n');
  console.log('=' . repeat(70) + '\n');
  
  // 1. Verify credentials file
  const credPath = './config/credentials/ga4-service-account-key.json';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  
  console.log('1️⃣ Service Account Details:');
  console.log(`   Email: ${creds.client_email}`);
  console.log(`   Project: ${creds.project_id}`);
  console.log(`   Private Key: ${creds.private_key ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Key Length: ${creds.private_key?.length || 0} characters\n`);
  
  // 2. Test with different property IDs in case there's a mismatch
  console.log('2️⃣ Testing Multiple Property IDs:\n');
  
  const propertyIdsToTest = [
    '320759942',      // Original
    '329759942',      // Common typo (9 instead of 0)
    '302759942',      // Another common typo
    '320759924',      // Transposition
  ];
  
  const client = new BetaAnalyticsDataClient();
  
  for (const propId of propertyIdsToTest) {
    try {
      console.log(`   Testing ${propId}...`);
      const [response] = await client.runReport({
        property: `properties/${propId}`,
        dateRanges: [{ startDate: '1daysAgo', endDate: '1daysAgo' }],
        metrics: [{ name: 'sessions' }],
        limit: 1
      });
      console.log(`   ✅ SUCCESS! Property ${propId} is accessible\n`);
      return propId; // Return the working property ID
    } catch (error) {
      console.log(`   ❌ Failed - ${error.code}: ${error.message.split('.')[0]}\n`);
    }
  }
  
  // 3. List all accessible properties (if any)
  console.log('3️⃣ Attempting to List Accessible Properties:\n');
  
  try {
    // Try to get property metadata without specifying property
    // This is a different approach to see what we have access to
    console.log('   Note: GA4 Data API doesn\'t support listing properties directly.');
    console.log('   We need to know the property ID in advance.\n');
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // 4. Check if this might be a Universal Analytics property ID
  console.log('4️⃣ Checking Property ID Format:\n');
  console.log('   GA4 Property IDs: 9 digits (e.g., 320759942)');
  console.log('   UA Property IDs: Format UA-XXXXXX-Y');
  console.log(`   Your ID (${propertyIdsToTest[0]}): ${propertyIdsToTest[0].length} digits - ✅ Correct GA4 format\n`);
  
  // 5. Service account domain check
  console.log('5️⃣ Service Account Domain Check:\n');
  const emailDomain = creds.client_email.split('@')[1];
  console.log(`   Service account domain: ${emailDomain}`);
  console.log(`   Expected: ${creds.project_id}.iam.gserviceaccount.com`);
  console.log(`   Match: ${emailDomain === `${creds.project_id}.iam.gserviceaccount.com` ? '✅' : '❌'}\n`);
  
  // 6. Final diagnosis
  console.log('📋 DIAGNOSIS:\n');
  console.log('Since permissions were added yesterday, the issue is likely one of:');
  console.log('\n1. Property ID Mismatch (Most Likely)');
  console.log('   - The property ID in our system might not match the actual GA4 property');
  console.log('   - Double-check in GA4: Admin → Property Settings → Property ID');
  console.log('\n2. Wrong GA4 Account/Property');
  console.log('   - You might have multiple GA4 accounts');
  console.log('   - Ensure you added the service account to the correct property');
  console.log('\n3. Service Account Issues');
  console.log('   - The service account might have been removed or modified');
  console.log('   - Check the Property Access Management again');
  
  console.log('\n🔍 IMMEDIATE ACTION:');
  console.log('1. Go to Google Analytics');
  console.log('2. Navigate to the Jay Hatfield Chevrolet property');
  console.log('3. Go to Admin → Property Settings');
  console.log('4. Copy the EXACT Property ID shown there');
  console.log('5. Compare it with: 320759942');
  console.log('\nIf they don\'t match exactly, that\'s the issue!');
}

deepDebug().catch(console.error);