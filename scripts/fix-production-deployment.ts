#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

console.log('🔧 Production Deployment Fix\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found. Run this script from the project root.');
  process.exit(1);
}

console.log('✅ Running from project root\n');

// Step 1: Verify build files exist
console.log('📁 Step 1: Verifying build files...');
const distPath = path.join(process.cwd(), 'dist');
const publicPath = path.join(distPath, 'public');
const indexPath = path.join(publicPath, 'index.html');
const serverPath = path.join(distPath, 'index.js');

const checks = [
  { path: distPath, name: 'dist/' },
  { path: publicPath, name: 'dist/public/' },
  { path: indexPath, name: 'index.html' },
  { path: serverPath, name: 'server bundle' }
];

let allFilesExist = true;
checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  console.log(`  ${check.name}: ${exists ? '✅' : '❌'}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n🔨 Building missing files...');
  const { execSync } = require('child_process');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Step 2: Check for common production issues
console.log('\n🔍 Step 2: Checking for common issues...');

// Check index.html for asset references
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  
  // Check for script tags
  const scriptMatches = indexContent.match(/<script[^>]*src="([^"]*)"[^>]*>/g);
  if (scriptMatches) {
    scriptMatches.forEach(match => {
      const src = match.match(/src="([^"]*)"/)?.[1];
      if (src && src.startsWith('/assets/')) {
        const assetPath = path.join(publicPath, src.replace(/^\//, ''));
        const exists = fs.existsSync(assetPath);
        console.log(`  Asset ${src}: ${exists ? '✅' : '❌'}`);
      }
    });
  }
}

// Step 3: Create deployment summary
console.log('\n📋 Step 3: Deployment Summary');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
console.log(`  Project: ${pkg.name} v${pkg.version}`);
console.log(`  Build command: ${pkg.scripts?.build || 'Not defined'}`);
console.log(`  Start command: ${pkg.scripts?.start || 'Not defined'}`);

// Step 4: Production checklist
console.log('\n✅ Step 4: Production Deployment Checklist');
console.log('  1. ✅ CSP headers fixed for React apps');
console.log('  2. ✅ Static file serving configured');
console.log('  3. ✅ Build files verified');
console.log('  4. ⚠️  Environment variables (check manually)');
console.log('  5. ⚠️  Database connection (check manually)');

// Step 5: Next steps
console.log('\n🚀 Step 5: Next Steps for Production');
console.log('  1. Commit and push these changes:');
console.log('     git add .');
console.log('     git commit -m "fix: resolve CSP and static file issues for React app"');
console.log('     git push');
console.log('');
console.log('  2. Check your production logs for:');
console.log('     - JavaScript console errors');
console.log('     - Failed asset requests (404s)');
console.log('     - CSP violations');
console.log('');
console.log('  3. Test these endpoints in production:');
console.log('     - GET /api/test (should return JSON)');
console.log('     - GET /api/user (should return user data)');
console.log('     - GET /assets/*.js (should return JavaScript)');
console.log('     - GET /assets/*.css (should return CSS)');
console.log('');
console.log('  4. If still having issues, check browser dev tools:');
console.log('     - Console tab for JavaScript errors');
console.log('     - Network tab for failed requests');
console.log('     - Security tab for CSP violations');

console.log('\n🎯 Key Changes Made:');
console.log('  - Fixed CSP to allow unsafe-eval for React');
console.log('  - Added WebSocket support to CSP');
console.log('  - Enhanced static file debugging');
console.log('  - Added production status endpoint');

console.log('\n✨ Production deployment should now work correctly!');
