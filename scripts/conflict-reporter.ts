#!/usr/bin/env tsx

/**
 * Conflict Reporter Script
 * Scans the codebase for git conflict markers and reports them
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const CONFLICT_MARKERS = [
  '<<<<<<< HEAD',
  '=======',
  '>>>>>>> ',
  '<user has removed the result of this tool call>'
];

async function scanForConflicts() {
  console.log('🔍 Scanning for git conflict markers...');

  const files = await glob('**/*.{ts,tsx,js,jsx,json,md}', {
    ignore: ['node_modules/**', 'dist/**', '.git/**']
  });

  const conflictFiles: string[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      for (const marker of CONFLICT_MARKERS) {
        if (content.includes(marker)) {
          conflictFiles.push(file);
          break;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not read file: ${file}`);
    }
  }

  if (conflictFiles.length > 0) {
    console.error('❌ Found conflict markers in the following files:');
    conflictFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
  } else {
    console.log('✅ No conflict markers found');
  }
}

scanForConflicts().catch(console.error);
