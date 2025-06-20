#!/usr/bin/env node

/**
 * Deployment fix script - Addresses all identified build issues
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔧 Running deployment fix script...\n');

// Step 1: Install fs-extra if not present
console.log('📦 Checking dependencies...');
try {
  require.resolve('fs-extra');
  console.log('✅ fs-extra is installed');
} catch {
  console.log('📥 Installing fs-extra...');
  execSync('npm install --save-dev fs-extra', {
    stdio: 'inherit',
    cwd: rootDir
  });
}

// Step 2: Ensure web-console dependencies are installed
console.log('\n🎨 Checking web-console dependencies...');
const webConsoleModules = path.join(rootDir, 'web-console/node_modules');
if (!fs.existsSync(webConsoleModules)) {
  console.log('📥 Installing web-console dependencies...');
  execSync('cd web-console && npm install', {
    stdio: 'inherit',
    cwd: rootDir
  });
} else {
  console.log('✅ web-console dependencies installed');
}

// Step 3: Run the build
console.log('\n🏗️  Running build...');
try {
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: rootDir
  });
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 4: Verify build output
console.log('\n🔍 Verifying build output...');
const checks = [
  { path: 'dist/index.js', desc: 'Server bundle' },
  { path: 'dist/public/index.html', desc: 'Frontend index' },
  { path: 'dist/public/assets', desc: 'Frontend assets', isDir: true }
];

let allChecksPass = true;
checks.forEach(check => {
  const fullPath = path.join(rootDir, check.path);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? '✅' : '❌'} ${check.desc}: ${check.path}`);
  if (!exists) allChecksPass = false;
});

if (!allChecksPass) {
  console.error('\n❌ Build verification failed - some files are missing');
  process.exit(1);
}

// Step 5: Test the build locally
console.log('\n🧪 Testing build locally...');
console.log('Run this command to test:');
console.log('  NODE_ENV=production PORT=3000 npm start');
console.log('\nThen check:');
console.log('  - http://localhost:3000/ (should load the app)');
console.log('  - http://localhost:3000/health (should return JSON)');

// Step 6: Environment variables reminder
console.log('\n🔐 Environment Variables Checklist:');
console.log('Ensure these are set in Render dashboard:');
const requiredEnvVars = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'NODE_ENV=production'
];
requiredEnvVars.forEach(env => {
  console.log(`  □ ${env}`);
});

// Step 7: Deployment steps
console.log('\n🚀 Ready to deploy! Next steps:');
console.log('1. Commit these changes:');
console.log('   git add -A');
console.log('   git commit -m "Fix deployment build issues"');
console.log('   git push origin main');
console.log('\n2. Render will automatically deploy');
console.log('\n3. Monitor the deploy logs in Render dashboard');
console.log('\n4. Once deployed, check:');
console.log('   - https://your-app.onrender.com/health');
console.log('   - https://your-app.onrender.com/');

console.log('\n✨ Deployment fix complete!');
