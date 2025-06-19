#!/usr/bin/env tsx

/**
 * Test script for SEOWerks onboarding flow
 * Tests the public API endpoint with sample data
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testOnboardingSubmission() {
  console.log('🧪 Testing SEOWerks Onboarding Flow...\n');

  const testData = {
    businessName: 'Test Motors Inc',
    websiteUrl: 'https://www.testmotors.com',
    email: 'john@testmotors.com',
    phone: '(555) 123-4567',
    address: '123 Main Street',
    city: 'Austin',
    state: 'Texas',
    zipCode: '78701',
    contactName: 'John Smith',
    contactTitle: 'General Manager',
    billingEmail: 'billing@testmotors.com',
    package: 'GOLD',
    mainBrand: 'Ford',
    targetVehicleModels: ['F-150', 'Mustang', 'Explorer'],
    targetCities: ['Austin', 'Round Rock', 'Cedar Park'],
    targetDealers: ['Competitor A', 'Competitor B', 'Competitor C'],
    siteAccessNotes: 'Test submission - please ignore',
    googleBusinessProfileAccess: true,
    googleAnalyticsAccess: true,
  };

  try {
    console.log('📤 Submitting test onboarding data...');
    
    const response = await fetch(`${API_URL}/api/public/seoworks-onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Submission successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Submission failed!');
      console.error('Status:', response.status);
      console.error('Error:', result);
    }

  } catch (error) {
    console.error('❌ Request failed!');
    console.error('Error:', error);
  }
}

// Run the test
testOnboardingSubmission()
  .then(() => {
    console.log('\n✨ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });