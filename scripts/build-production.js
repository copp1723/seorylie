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
  
  // Ensure we copy all files including HTML
  const webConsoleDist = path.join(rootDir, 'web-console/dist');
  const distPublic = path.join(rootDir, 'dist/public');
  
  // Copy all files from web-console/dist to dist/public
  fs.copySync(webConsoleDist, distPublic, {
    overwrite: true,
    errorOnExist: false
  });
  
  // Verify index.html exists
  if (!fs.existsSync(path.join(distPublic, 'index.html'))) {
    throw new Error('index.html not found in web-console build output');
  }
  
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
  
  // Enhanced build verification
  console.log('\n📋 Verifying build output...');
  
  const requiredDirs = [
    'dist',
    'dist/public',
    'dist/public/assets',
  ];
  
  const enhancedRequiredFiles = [
    { path: 'dist/index.js', minSize: 1000 },
    { path: 'dist/public/index.html', minSize: 100 },
  ];
  
  // Check directories
  const missingDirs = requiredDirs.filter(dir => !fs.existsSync(path.join(rootDir, dir)));
  if (missingDirs.length > 0) {
    throw new Error(`Build verification failed. Missing directories: ${missingDirs.join(', ')}`);
  }
  
  // Check files and sizes
  for (const fileCheck of enhancedRequiredFiles) {
    const fullPath = path.join(rootDir, fileCheck.path);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Build verification failed. Missing file: ${fileCheck.path}`);
    }
    
    const stat = fs.statSync(fullPath);
    if (stat.size < fileCheck.minSize) {
      throw new Error(`Build verification failed. File too small: ${fileCheck.path} (${stat.size} bytes, expected at least ${fileCheck.minSize})`);
    }
  }
  
  // Check that assets directory exists and is not empty
  const assetsDir = path.join(rootDir, 'dist/public/assets');
  if (fs.existsSync(assetsDir)) {
    const assets = fs.readdirSync(assetsDir);
    if (assets.length === 0) {
      console.warn('⚠️  Warning: assets directory is empty');
    }
  }
  
  console.log('✅ Build verification passed');
  console.log('📦 Build output structure:');
  console.log('   dist/');
  console.log('   ├── index.js');
  console.log('   └── public/');
  console.log('       ├── index.html');
  console.log('       └── assets/');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
