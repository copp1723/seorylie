#!/usr/bin/env node

/**
 * Dependency Verification Script
 * Ensures all required dependencies are available for CI
 */

const fs = require('fs');
const path = require('path');

function checkDependencies() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found');
    process.exit(1);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ node_modules directory not found');
    process.exit(1);
  }
  
  console.log('✅ package.json found');
  console.log('✅ node_modules directory exists');
  
  // Check critical dependencies
  const criticalDeps = [
    'express',
    'jest',
    'typescript',
    'drizzle-orm',
    'pg',
    'zod'
  ];
  
  const missingDeps = [];
  
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      missingDeps.push(dep);
    }
  });
  
  if (missingDeps.length > 0) {
    console.error('❌ Missing critical dependencies:', missingDeps.join(', '));
    console.log('💡 Try running: npm install');
    process.exit(1);
  }
  
  console.log('✅ All critical dependencies are available');
  
  // Check if TypeScript can compile
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --version', { stdio: 'pipe' });
    console.log('✅ TypeScript compiler is available');
  } catch (error) {
    console.warn('⚠️  TypeScript compiler check failed');
  }
  
  // Check Jest availability
  try {
    const { execSync } = require('child_process');
    execSync('npx jest --version', { stdio: 'pipe' });
    console.log('✅ Jest test runner is available');
  } catch (error) {
    console.warn('⚠️  Jest test runner check failed');
  }
  
  console.log('\n🎉 Dependency verification completed successfully!');
}

if (require.main === module) {
  checkDependencies();
}

module.exports = { checkDependencies };
