#!/usr/bin/env node

/**
 * Test script to verify build setup
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔍 Testing build configuration...\n');

// Check Node version
console.log('📌 Node Version:', process.version);

// Check if required directories exist
console.log('\n📁 Checking project structure:');
const dirs = [
  'web-console',
  'server',
  'config/build',
  'scripts'
];

dirs.forEach(dir => {
  const exists = fs.existsSync(path.join(rootDir, dir));
  console.log(`  ${exists ? '✅' : '❌'} ${dir}`);
});

// Check if build dependencies are installed
console.log('\n📦 Checking build dependencies:');
try {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  const requiredDeps = ['esbuild', 'typescript', 'tsx'];
  requiredDeps.forEach(dep => {
    const hasDep = pkg.devDependencies?.[dep] || pkg.dependencies?.[dep];
    console.log(`  ${hasDep ? '✅' : '❌'} ${dep}`);
  });
} catch (error) {
  console.error('  ❌ Failed to read package.json');
}

// Check web-console build setup
console.log('\n🎨 Checking web-console build:');
const webConsolePkg = path.join(rootDir, 'web-console/package.json');
if (fs.existsSync(webConsolePkg)) {
  console.log('  ✅ web-console/package.json exists');
  
  // Check if node_modules exists
  const webConsoleModules = path.join(rootDir, 'web-console/node_modules');
  if (fs.existsSync(webConsoleModules)) {
    console.log('  ✅ web-console dependencies installed');
  } else {
    console.log('  ⚠️  web-console dependencies not installed');
    console.log('     Run: cd web-console && npm install');
  }
} else {
  console.log('  ❌ web-console/package.json missing');
}

// Test esbuild config
console.log('\n🔧 Testing esbuild configuration:');
const esbuildConfig = path.join(rootDir, 'config/build/esbuild.config.js');
if (fs.existsSync(esbuildConfig)) {
  console.log('  ✅ esbuild.config.js exists');
} else {
  console.log('  ❌ esbuild.config.js missing');
}

// Check current dist structure
console.log('\n📂 Current dist structure:');
const distPath = path.join(rootDir, 'dist');
if (fs.existsSync(distPath)) {
  const showDirTree = (dir, prefix = '') => {
    const items = fs.readdirSync(dir);
    items.forEach((item, index) => {
      const itemPath = path.join(dir, item);
      const isLast = index === items.length - 1;
      const stats = fs.statSync(itemPath);
      
      console.log(`${prefix}${isLast ? '└── ' : '├── '}${item}${stats.isDirectory() ? '/' : ''}`);
      
      if (stats.isDirectory() && item !== 'node_modules' && item !== 'assets') {
        showDirTree(itemPath, prefix + (isLast ? '    ' : '│   '));
      }
    });
  };
  
  showDirTree(distPath, '  ');
} else {
  console.log('  ⚠️  dist directory does not exist');
}

// Provide recommendations
console.log('\n💡 Recommendations:');
console.log('1. Install fs-extra: npm install --save-dev fs-extra');
console.log('2. Run the new build: npm run build');
console.log('3. Test locally: NODE_ENV=production npm start');
console.log('4. Check http://localhost:3000/health');

console.log('\n✨ Test complete!');
