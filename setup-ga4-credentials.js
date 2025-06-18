#!/usr/bin/env node

// Script to configure GA4 service account credentials
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupGA4Credentials() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check if service account already exists
    const existing = await client.query('SELECT * FROM ga4_service_account LIMIT 1');
    
    if (existing.rows.length > 0) {
      console.log('✅ Service account already configured:');
      console.log(`   Email: ${existing.rows[0].email}`);
      console.log(`   Active: ${existing.rows[0].is_active}`);
      console.log(`   Created: ${existing.rows[0].created_at}\n`);
      
      const response = await prompt('Update existing credentials? (y/n): ');
      if (response.toLowerCase() !== 'y') {
        console.log('Keeping existing credentials.');
        return;
      }
    }

    // Check for service account key file
    const keyPath = process.env.GA4_SERVICE_ACCOUNT_KEY_PATH || 
                    path.join(__dirname, 'ga4-service-account-key.json');
    
    if (!fs.existsSync(keyPath)) {
      console.log(`\n❌ Service account key file not found at: ${keyPath}`);
      console.log('\nTo set up GA4 credentials:');
      console.log('1. Create a service account in Google Cloud Console');
      console.log('2. Download the JSON key file');
      console.log('3. Place it at:', keyPath);
      console.log('4. Run this script again\n');
      return;
    }

    // Read and parse the service account key
    const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    if (!keyData.client_email || !keyData.private_key) {
      throw new Error('Invalid service account key file');
    }

    console.log(`\n📧 Service Account Email: ${keyData.client_email}`);
    console.log('🔑 Private key found\n');

    // Store in database
    if (existing.rows.length > 0) {
      // Update existing
      await client.query(
        `UPDATE ga4_service_account 
         SET email = $1, credentials = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [keyData.client_email, keyData, existing.rows[0].id]
      );
      console.log('✅ Service account credentials updated!');
    } else {
      // Insert new
      await client.query(
        `INSERT INTO ga4_service_account (email, credentials, is_active) 
         VALUES ($1, $2, true)`,
        [keyData.client_email, keyData]
      );
      console.log('✅ Service account credentials saved!');
    }

    // Add test properties for Rowdy
    console.log('\n=== Setting up test properties for Rowdy ===');
    
    const testProperties = [
      {
        dealership_id: '123e4567-e89b-12d3-a456-426614174000', // Test dealership ID
        property_id: '320759942',
        property_name: 'Rowdy Test Property 1',
        website_url: 'https://example1.com'
      },
      {
        dealership_id: '123e4567-e89b-12d3-a456-426614174000',
        property_id: '317592148',
        property_name: 'Rowdy Test Property 2',
        website_url: 'https://example2.com'
      }
    ];

    for (const prop of testProperties) {
      try {
        await client.query(
          `INSERT INTO ga4_properties 
           (dealership_id, property_id, property_name, website_url) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (dealership_id, property_id) DO NOTHING`,
          [prop.dealership_id, prop.property_id, prop.property_name, prop.website_url]
        );
        console.log(`✅ Added property: ${prop.property_id} - ${prop.property_name}`);
      } catch (err) {
        console.log(`⚠️  Property ${prop.property_id} might already exist`);
      }
    }

    console.log('\n=== Setup Complete! ===');
    console.log('\nNext steps:');
    console.log(`1. Share this service account email with Rowdy: ${keyData.client_email}`);
    console.log('2. Ask them to add it as a Viewer to their GA4 properties');
    console.log('3. Test the integration with the property IDs above');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

// Simple prompt function
function prompt(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run the setup
setupGA4Credentials();