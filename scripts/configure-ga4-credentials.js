#!/usr/bin/env node

/**
 * GA4 Service Account Configuration Script
 * 
 * This script helps set up the GA4 service account credentials
 * and test the connection to Rowdy's properties
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_PATH = path.join(__dirname, '..', '.env');

// Rowdy's test properties
const TEST_PROPERTIES = [
  {
    name: 'Jay Hatfield Chevrolet of Vinita',
    propertyId: '320759942',
    measurementId: 'G-ZJQKZZHVTM',
    url: 'https://www.jayhatfieldchevroletvinita.com/'
  },
  {
    name: 'Jay Hatfield Motorsports of Wichita',
    propertyId: '317592148',
    measurementId: 'G-DBMQEB1TM0',
    url: 'https://www.kansasmotorsports.com/'
  }
];

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function updateEnvFile(key, value) {
  let envContent = '';
  
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  }
  
  const regex = new RegExp(`^${key}=.*$`, 'gm');
  
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  
  fs.writeFileSync(ENV_PATH, envContent);
  console.log(`✓ Updated ${key} in .env file`);
}

async function main() {
  console.log('=== GA4 Service Account Configuration ===\n');
  
  console.log('Step 1: Service Account Email');
  console.log('After creating the service account in Google Cloud Console,');
  console.log('you should have a service account email like:');
  console.log('rylie-seo-ga4@your-project-id.iam.gserviceaccount.com\n');
  
  const serviceAccountEmail = await question('Enter your service account email: ');
  
  console.log('\nStep 2: Service Account Key');
  console.log('Download the JSON key file from Google Cloud Console.');
  console.log('Save it as: server/config/ga4-service-account-key.json\n');
  
  const keyFilePath = path.join(__dirname, '..', 'server', 'config', 'ga4-service-account-key.json');
  
  const hasKey = await question('Have you saved the key file? (yes/no): ');
  
  if (hasKey.toLowerCase() !== 'yes') {
    console.log('\nPlease download and save the key file first, then run this script again.');
    rl.close();
    return;
  }
  
  if (!fs.existsSync(keyFilePath)) {
    console.log('\n❌ Key file not found at:', keyFilePath);
    console.log('Please save the key file at the correct location and try again.');
    rl.close();
    return;
  }
  
  console.log('\n✓ Key file found!');
  
  // Update .env file
  console.log('\nUpdating .env file...');
  await updateEnvFile('GA4_SERVICE_ACCOUNT_EMAIL', serviceAccountEmail);
  await updateEnvFile('GA4_KEY_FILE_PATH', './server/config/ga4-service-account-key.json');
  
  // Add test property IDs
  await updateEnvFile('GA4_TEST_PROPERTY_ID_1', TEST_PROPERTIES[0].propertyId);
  await updateEnvFile('GA4_TEST_PROPERTY_ID_2', TEST_PROPERTIES[1].propertyId);
  
  console.log('\n=== Next Steps ===');
  console.log('\nPlease share the following instructions with Rowdy:\n');
  
  console.log('To grant access to your GA4 properties:');
  console.log('1. Go to Google Analytics (analytics.google.com)');
  console.log('2. For each property:');
  console.log('   - Click Admin (gear icon)');
  console.log('   - Under "Property", click "Property Access Management"');
  console.log('   - Click the "+" button to add users');
  console.log(`   - Add this email: ${serviceAccountEmail}`);
  console.log('   - Set role to "Viewer"');
  console.log('   - Click "Add"\n');
  
  console.log('Test Properties to configure:');
  TEST_PROPERTIES.forEach(prop => {
    console.log(`\n- ${prop.name}`);
    console.log(`  Property ID: ${prop.propertyId}`);
    console.log(`  Measurement ID: ${prop.measurementId}`);
  });
  
  console.log('\n✓ Configuration complete!');
  console.log('\nYou can now run: npm run test:ga4');
  console.log('to test the connection once Rowdy grants access.');
  
  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});