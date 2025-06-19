#!/usr/bin/env node
/**
 * Find duplicate files and similar code patterns in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface FileInfo {
  path: string;
  size: number;
  hash: string;
  content: string;
}

interface DuplicateGroup {
  hash: string;
  files: string[];
  size: number;
}

class DuplicateFinder {
  private files: Map<string, FileInfo> = new Map();
  private excludeDirs = ['node_modules', '.git', 'dist', '.backup', '.backup-restructure', 'archive'];
  private targetExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  async findDuplicates(rootDir: string): Promise<void> {
    console.log('🔍 Scanning for duplicate files...\n');
    
    // Scan all files
    await this.scanDirectory(rootDir);
    
    // Group by hash
    const duplicates = this.groupDuplicates();
    
    // Report findings
    this.reportDuplicates(duplicates);
    this.reportSimilarNames();
    this.reportPotentialConsolidations();
  }

  private async scanDirectory(dir: string): Promise<void> {
    try {
      const items = await readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          if (!this.excludeDirs.includes(item)) {
            await this.scanDirectory(fullPath);
          }
        } else if (this.isTargetFile(item)) {
          await this.processFile(fullPath, stats);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private isTargetFile(filename: string): boolean {
    return this.targetExtensions.some(ext => filename.endsWith(ext));
  }

  private async processFile(filePath: string, stats: fs.Stats): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf8');
      const hash = this.hashContent(content);
      
      this.files.set(filePath, {
        path: filePath,
        size: stats.size,
        hash,
        content
      });
    } catch (error) {
      // Skip files we can't read
    }
  }

  private hashContent(content: string): string {
    // Normalize content to ignore whitespace differences
    const normalized = content
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  private groupDuplicates(): DuplicateGroup[] {
    const groups = new Map<string, string[]>();
    
    for (const [path, info] of this.files) {
      if (!groups.has(info.hash)) {
        groups.set(info.hash, []);
      }
      groups.get(info.hash)!.push(path);
    }
    
    // Filter to only actual duplicates
    return Array.from(groups.entries())
      .filter(([_, files]) => files.length > 1)
      .map(([hash, files]) => ({
        hash,
        files,
        size: this.files.get(files[0])!.size
      }));
  }

  private reportDuplicates(duplicates: DuplicateGroup[]): void {
    console.log('## 📋 Exact Duplicate Files\n');
    
    if (duplicates.length === 0) {
      console.log('✅ No exact duplicates found!\n');
      return;
    }
    
    let totalWasted = 0;
    
    for (const group of duplicates) {
      console.log(`### Duplicate Group (${group.files.length} files, ${group.size} bytes each):`);
      for (const file of group.files) {
        console.log(`  - ${file}`);
      }
      totalWasted += group.size * (group.files.length - 1);
      console.log('');
    }
    
    console.log(`💾 Total wasted space: ${(totalWasted / 1024).toFixed(2)} KB\n`);
  }

  private reportSimilarNames(): void {
    console.log('## 🔤 Similar Named Files (potential duplicates)\n');
    
    const filesByName = new Map<string, string[]>();
    
    for (const [filePath] of this.files) {
      const basename = path.basename(filePath).toLowerCase();
      const nameWithoutExt = basename.replace(/\.[^.]+$/, '');
      
      if (!filesByName.has(nameWithoutExt)) {
        filesByName.set(nameWithoutExt, []);
      }
      filesByName.get(nameWithoutExt)!.push(filePath);
    }
    
    let found = false;
    for (const [name, paths] of filesByName) {
      if (paths.length > 1) {
        found = true;
        console.log(`### "${name}" found in multiple locations:`);
        for (const p of paths) {
          console.log(`  - ${p}`);
        }
        console.log('');
      }
    }
    
    if (!found) {
      console.log('✅ No similar named files found!\n');
    }
  }

  private reportPotentialConsolidations(): void {
    console.log('## 🎯 Potential Consolidations\n');
    
    // Auth-related files
    this.checkPattern('auth', [
      'auth', 'authentication', 'jwt', 'magic-link', 'login'
    ]);
    
    // Email-related files
    this.checkPattern('email', [
      'email', 'mail', 'sendgrid', 'smtp'
    ]);
    
    // AI/Chat-related files
    this.checkPattern('AI/Chat services', [
      'ai-service', 'ai-proxy', 'chat', 'conversation', 'openai'
    ]);
    
    // Database-related files
    this.checkPattern('database', [
      'db', 'database', 'schema', 'pool', 'postgres'
    ]);
    
    // SEOWorks-related files
    this.checkPattern('SEOWorks', [
      'seoworks', 'seowerks', 'seo-works'
    ]);
  }

  private checkPattern(category: string, patterns: string[]): void {
    const matches: string[] = [];
    
    for (const [filePath] of this.files) {
      const filename = path.basename(filePath).toLowerCase();
      if (patterns.some(pattern => filename.includes(pattern))) {
        matches.push(filePath);
      }
    }
    
    if (matches.length > 3) {
      console.log(`### ${category} (${matches.length} files):`);
      matches.sort().forEach(m => console.log(`  - ${m}`));
      console.log('  ⚠️  Consider consolidating these into a single module\n');
    }
  }
}

// Run the duplicate finder
const finder = new DuplicateFinder();
const rootDir = path.join(__dirname, '../..');

finder.findDuplicates(rootDir).catch(console.error);
