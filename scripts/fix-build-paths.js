#!/usr/bin/env node

/**
 * Fix build path issues by copying frontend files to correct location
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔧 Fixing build paths...');

try {
  // Ensure dist/public exists
  const distPublicPath = path.join(rootDir, 'dist/public');
  fs.ensureDirSync(distPublicPath);
  
  // Copy frontend build files
  const webConsoleDist = path.join(rootDir, 'web-console/dist');
  
  if (fs.existsSync(webConsoleDist)) {
    console.log('📋 Copying frontend build files...');
    fs.copySync(webConsoleDist, distPublicPath);
    
    // Verify critical files
    const indexPath = path.join(distPublicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log('✅ index.html copied successfully');
    } else {
      throw new Error('index.html not found after copy!');
    }
    
    // List what was copied
    const files = fs.readdirSync(distPublicPath);
    console.log('📁 Files in dist/public:', files);
    
  } else {
    console.error('❌ web-console/dist not found! Run frontend build first.');
    process.exit(1);
  }
  
  console.log('✨ Build paths fixed!');
  
} catch (error) {
  console.error('❌ Error fixing build paths:', error.message);
  process.exit(1);
}
