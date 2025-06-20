#!/usr/bin/env node

/**
 * Production build script that ensures proper file structure
 */
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔨 Starting production build...');

try {
  // Step 1: Clean previous builds
  console.log('📦 Cleaning previous builds...');
  fs.removeSync(path.join(rootDir, 'dist'));
  
  // Step 2: Build frontend
  console.log('🎨 Building web console...');
  execSync('pnpm --filter seorylie-web-console build', {
    stdio: 'inherit',
    cwd: rootDir
  });
  
  // Step 3: Copy frontend build to correct location
  console.log('📋 Copying frontend build to dist/public...');
  fs.ensureDirSync(path.join(rootDir, 'dist/public'));
  fs.copySync(
    path.join(rootDir, 'web-console/dist'),
    path.join(rootDir, 'dist/public')
  );
  
  // Step 4: Build server
  console.log('🖥️  Building server...');
  execSync('pnpm run build:server', {
    stdio: 'inherit',
    cwd: rootDir
  });
  
  // Step 5: Verify build
  console.log('✅ Verifying build...');
  const requiredFiles = [
    'dist/index.js',
    'dist/public/index.html'
  ];
  
  for (const file of requiredFiles) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  
  console.log('✨ Build completed successfully!');
  console.log('📁 Build artifacts:');
  console.log('   - Server: dist/index.js');
  console.log('   - Frontend: dist/public/');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
