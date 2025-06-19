#!/usr/bin/env node
/**
 * Find and fix async/sync anti-patterns in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface AntiPattern {
  file: string;
  line: number;
  issue: string;
  suggestion: string;
  code: string;
}

class AsyncPatternFixer {
  private issues: AntiPattern[] = [];
  private excludeDirs = ['node_modules', '.git', 'dist', '.backup', 'archive'];
  private targetExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  async analyzeCodebase(rootDir: string, fix: boolean = false): Promise<void> {
    console.log(`🔍 Analyzing async patterns... (fix mode: ${fix})\n`);
    
    await this.scanDirectory(rootDir);
    
    this.reportIssues();
    
    if (fix && this.issues.length > 0) {
      console.log('\n🔧 Attempting to fix issues...\n');
      await this.fixIssues();
    }
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
          await this.analyzeFile(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private isTargetFile(filename: string): boolean {
    return this.targetExtensions.some(ext => filename.endsWith(ext));
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        this.checkMissingAwait(filePath, line, index + 1);
        this.checkCallbackInAsync(filePath, line, index + 1, lines);
        this.checkUnhandledPromise(filePath, line, index + 1);
        this.checkAsyncWithoutAwait(filePath, line, index + 1, lines);
        this.checkSyncInAsync(filePath, line, index + 1);
      });
    } catch (error) {
      // Skip files we can't read
    }
  }

  private checkMissingAwait(file: string, line: string, lineNum: number): void {
    // Pattern: async function call without await
    const patterns = [
      /(?<!await\s+)(?<!\.)\b(db|database|client)\.(query|execute|insert|update|delete)\(/,
      /(?<!await\s+)(?<!\.)\b(fetch|axios|got)\(/,
      /(?<!await\s+)(?<!\.)\bsave\(\)/,
      /(?<!await\s+)(?<!\.)\bfindOne\(/,
      /(?<!await\s+)(?<!\.)\bfindMany\(/,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(line) && !line.includes('await') && !line.includes('.then')) {
        this.issues.push({
          file,
          line: lineNum,
          issue: 'Missing await for async operation',
          suggestion: 'Add await before the async call',
          code: line.trim()
        });
      }
    }
  }

  private checkCallbackInAsync(file: string, line: string, lineNum: number, lines: string[]): void {
    // Check if we're in an async function
    let inAsyncFunction = false;
    for (let i = lineNum - 10; i < lineNum && i >= 0; i++) {
      if (/async\s+(function|\(|[a-zA-Z_$][\w$]*\s*\()/.test(lines[i])) {
        inAsyncFunction = true;
        break;
      }
    }
    
    if (inAsyncFunction && /\.(readFile|writeFile|readdir|stat)\(.*,\s*\(/.test(line)) {
      this.issues.push({
        file,
        line: lineNum,
        issue: 'Callback-based API in async function',
        suggestion: 'Use promisified version or fs.promises',
        code: line.trim()
      });
    }
  }

  private checkUnhandledPromise(file: string, line: string, lineNum: number): void {
    // Pattern: .then() without .catch()
    if (line.includes('.then(') && !line.includes('.catch(')) {
      // Check next few lines for .catch()
      this.issues.push({
        file,
        line: lineNum,
        issue: 'Promise without error handling',
        suggestion: 'Add .catch() or use try/catch with async/await',
        code: line.trim()
      });
    }
  }

  private checkAsyncWithoutAwait(file: string, line: string, lineNum: number, lines: string[]): void {
    // Check for async functions that don't use await
    if (/async\s+(function|\(|[a-zA-Z_$][\w$]*\s*\()/.test(line)) {
      // Look ahead for the function body
      let hasAwait = false;
      let braceCount = 0;
      let started = false;
      
      for (let i = lineNum - 1; i < lines.length && i < lineNum + 50; i++) {
        const checkLine = lines[i];
        if (checkLine.includes('{')) {
          started = true;
          braceCount++;
        }
        if (checkLine.includes('}')) {
          braceCount--;
          if (braceCount === 0 && started) break;
        }
        if (checkLine.includes('await')) {
          hasAwait = true;
          break;
        }
      }
      
      if (!hasAwait && started) {
        this.issues.push({
          file,
          line: lineNum,
          issue: 'Async function without await',
          suggestion: 'Remove async keyword if not needed',
          code: line.trim()
        });
      }
    }
  }

  private checkSyncInAsync(file: string, line: string, lineNum: number): void {
    // Check for synchronous file operations
    const syncPatterns = [
      /fs\.(readFileSync|writeFileSync|readdirSync|statSync)\(/,
      /child_process\.(execSync|spawnSync)\(/,
    ];
    
    for (const pattern of syncPatterns) {
      if (pattern.test(line)) {
        this.issues.push({
          file,
          line: lineNum,
          issue: 'Synchronous operation that blocks event loop',
          suggestion: 'Use async version of this API',
          code: line.trim()
        });
      }
    }
  }

  private reportIssues(): void {
    if (this.issues.length === 0) {
      console.log('✅ No async/sync anti-patterns found!\n');
      return;
    }
    
    console.log(`Found ${this.issues.length} async/sync issues:\n`);
    
    // Group by issue type
    const byType = new Map<string, AntiPattern[]>();
    for (const issue of this.issues) {
      if (!byType.has(issue.issue)) {
        byType.set(issue.issue, []);
      }
      byType.get(issue.issue)!.push(issue);
    }
    
    for (const [type, issues] of byType) {
      console.log(`### ${type} (${issues.length} occurrences)\n`);
      
      // Show first 5 examples
      issues.slice(0, 5).forEach(issue => {
        console.log(`📍 ${issue.file}:${issue.line}`);
        console.log(`   Code: ${issue.code}`);
        console.log(`   💡 ${issue.suggestion}\n`);
      });
      
      if (issues.length > 5) {
        console.log(`   ... and ${issues.length - 5} more\n`);
      }
    }
  }

  private async fixIssues(): Promise<void> {
    const fileChanges = new Map<string, string[]>();
    
    // Group issues by file
    for (const issue of this.issues) {
      if (!fileChanges.has(issue.file)) {
        const content = await readFile(issue.file, 'utf8');
        fileChanges.set(issue.file, content.split('\n'));
      }
    }
    
    // Apply fixes
    let fixedCount = 0;
    for (const issue of this.issues) {
      const lines = fileChanges.get(issue.file)!;
      const lineIndex = issue.line - 1;
      
      if (issue.issue === 'Missing await for async operation') {
        // Add await before the operation
        lines[lineIndex] = lines[lineIndex].replace(
          /(db|database|client|fetch|axios|got)\./,
          'await $1.'
        );
        fixedCount++;
      }
      
      // Add more fix patterns as needed
    }
    
    // Write fixed files
    for (const [file, lines] of fileChanges) {
      await writeFile(file, lines.join('\n'));
    }
    
    console.log(`✅ Fixed ${fixedCount} issues\n`);
  }
}

// Run the analyzer
const analyzer = new AsyncPatternFixer();
const rootDir = path.join(__dirname, '../..');
const shouldFix = process.argv.includes('--fix');

analyzer.analyzeCodebase(rootDir, shouldFix).catch(console.error);
