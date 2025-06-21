#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying production build...\n');

const checks = [
  {
    name: 'Server entry point',
    path: 'dist/index.js',
    type: 'file',
    minSize: 1000, // At least 1KB
  },
  {
    name: 'Frontend HTML',
    path: 'dist/public/index.html',
    type: 'file',
    minSize: 100,
  },
  {
    name: 'Frontend assets',
    path: 'dist/public/assets',
    type: 'directory',
  },
  {
    name: 'Package files',
    path: 'package.json',
    type: 'file',
  },
];

let failed = false;

checks.forEach(check => {
  process.stdout.write(`Checking ${check.name}... `);
  
  if (!fs.existsSync(check.path)) {
    console.log('❌ MISSING');
    failed = true;
    return;
  }
  
  const stat = fs.statSync(check.path);
  
  if (check.type === 'file' && !stat.isFile()) {
    console.log('❌ NOT A FILE');
    failed = true;
    return;
  }
  
  if (check.type === 'directory' && !stat.isDirectory()) {
    console.log('❌ NOT A DIRECTORY');
    failed = true;
    return;
  }
  
  if (check.minSize && stat.size < check.minSize) {
    console.log(`❌ TOO SMALL (${stat.size} bytes)`);
    failed = true;
    return;
  }
  
  console.log('✅');
});

if (failed) {
  console.log('\n❌ Build verification failed');
  process.exit(1);
} else {
  console.log('\n✅ All build checks passed');
}