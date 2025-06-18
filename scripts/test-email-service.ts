#!/usr/bin/env tsx

/**
 * Test script for email service
 * Usage: npm run test:email -- your-email@example.com
 */

import { testEmailConfiguration, sendOnboardingEmails } from '../server/services/emailService';

async function testEmails() {
  const testEmail = process.argv[2];
  
  if (!testEmail) {
    console.error('Please provide a test email address');
    console.log('Usage: npm run test:email -- your-email@example.com');
    process.exit(1);
  }

  console.log(`Testing email service with: ${testEmail}`);

  // Test basic configuration
  console.log('\n1. Testing email configuration...');
  const configTest = await testEmailConfiguration(testEmail);
  if (configTest) {
    console.log('✅ Email configuration test passed');
  } else {
    console.log('❌ Email configuration test failed');
    console.log('Make sure SENDGRID_API_KEY is set in your environment');
    process.exit(1);
  }

  // Test onboarding email
  console.log('\n2. Testing onboarding confirmation email...');
  try {
    await sendOnboardingEmails({
      dealershipEmail: testEmail,
      dealershipName: 'Test Motors',
      contactName: 'John Doe',
      package: 'GOLD',
      submissionId: 'test-123',
      tasksCreated: 5
    });
    console.log('✅ Onboarding email sent successfully');
  } catch (error) {
    console.log('❌ Onboarding email failed:', error);
  }

  console.log('\n✨ Email testing complete! Check your inbox.');
}

testEmails().catch(console.error);