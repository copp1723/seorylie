#!/usr/bin/env node

// Script to convert GA4 service account JSON to single-line format for Render

const fs = require('fs');
const path = require('path');

const keyPath = process.argv[2];

if (!keyPath) {
  console.error('Usage: node convert-ga4-key.js <path-to-service-account-key.json>');
  process.exit(1);
}

try {
  const keyContent = fs.readFileSync(keyPath, 'utf8');
  const keyJson = JSON.parse(keyContent);
  
  // Convert to single line
  const singleLine = JSON.stringify(keyJson);
  
  console.log('\n✅ Converted GA4 Service Account Key:');
  console.log('=' .repeat(80));
  console.log(singleLine);
  console.log('=' .repeat(80));
  console.log('\n📋 Copy the above line and paste it as the value for GA4_SERVICE_ACCOUNT_KEY in Render\n');
  
  // Also save to a file
  const outputPath = path.join(path.dirname(keyPath), 'ga4-key-for-render.txt');
  fs.writeFileSync(outputPath, singleLine);
  console.log(`💾 Also saved to: ${outputPath}\n`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}