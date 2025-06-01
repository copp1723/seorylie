#!/usr/bin/env node

console.log('🔍 Debug Build Process');
console.log('📁 Current working directory:', process.cwd());
console.log('📂 Directory contents:');

const fs = require('fs');
const path = require('path');

try {
  const files = fs.readdirSync('.');
  files.forEach(file => {
    const stat = fs.statSync(file);
    console.log(`  ${stat.isDirectory() ? '📁' : '📄'} ${file}`);
  });
} catch (err) {
  console.error('❌ Error reading directory:', err.message);
}

console.log('\n🔍 Checking for key files:');
const keyFiles = ['package.json', 'server/index.ts', 'vite.config.ts', 'client/src/main.tsx'];

keyFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

console.log('\n🔍 Node.js version:', process.version);
console.log('🔍 Environment:', process.env.NODE_ENV || 'not set');

console.log('\n📦 Checking npm/node setup:');
const { execSync } = require('child_process');

try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log('✅ npm version:', npmVersion);
} catch (err) {
  console.log('❌ npm not found:', err.message);
}

try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log('✅ node version:', nodeVersion);
} catch (err) {
  console.log('❌ node version check failed:', err.message);
}

console.log('\n🔍 Build command test:');
console.log('About to run: npm run build');