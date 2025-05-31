#!/usr/bin/env node

// Simple environment check without database dependency
require('dotenv').config();

const requiredVars = [
  'DATABASE_URL',
  'SESSION_SECRET', 
  'OPENAI_API_KEY'
];

const optionalVars = [
  'SENDGRID_API_KEY',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'CREDENTIALS_ENCRYPTION_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER'
];

console.log('🔍 Environment Variables Check\n');

console.log('✅ Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === 'optional-for-now') {
    console.log(`❌ ${varName}: MISSING or PLACEHOLDER`);
  } else {
    console.log(`✅ ${varName}: SET (${value.substring(0, 10)}...)`);
  }
});

console.log('\n⚠️  Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === 'optional-for-now') {
    console.log(`⚠️  ${varName}: NOT SET`);
  } else {
    console.log(`✅ ${varName}: SET (${value.substring(0, 10)}...)`);
  }
});

console.log('\n📋 Summary:');
console.log('- DATABASE_URL: Make sure PostgreSQL is running');
console.log('- SENDGRID_API_KEY: Get from https://app.sendgrid.com/settings/api_keys');
console.log('- TWILIO_*: Get from https://console.twilio.com/');
console.log('- Use admin dashboard at /settings to configure APIs after startup');