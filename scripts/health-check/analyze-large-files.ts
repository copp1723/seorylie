#!/usr/bin/env node
/**
 * Analyze and report on large files that need to be broken down
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface FileAnalysis {
  path: string;
  size: number;
  lines: number;
  functions: number;
  classes: number;
  imports: number;
  exports: number;
  complexity: number;
  suggestions: string[];
}

class LargeFileAnalyzer {
  private excludeDirs = ['node_modules', '.git', 'dist', '.backup', 'archive'];
  private targetExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  private sizeThreshold = 10 * 1024; // 10KB
  private lineThreshold = 300; // 300 lines

  async analyze(rootDir: string): Promise<void> {
    console.log('🔍 Analyzing large files...\n');
    
    const largeFiles = await this.findLargeFiles(rootDir);
    const analyses = await Promise.all(
      largeFiles.map(file => this.analyzeFile(file))
    );
    
    this.reportFindings(analyses);
    this.generateRefactoringPlan(analyses);
  }

  private async findLargeFiles(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const items = await readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          if (!this.excludeDirs.includes(item)) {
            await this.findLargeFiles(fullPath, files);
          }
        } else if (this.isTargetFile(item) && stats.size > this.sizeThreshold) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return files;
  }

  private isTargetFile(filename: string): boolean {
    return this.targetExtensions.some(ext => filename.endsWith(ext));
  }

  private async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const stats = await stat(filePath);
    
    const analysis: FileAnalysis = {
      path: filePath,
      size: stats.size,
      lines: lines.length,
      functions: this.countFunctions(content),
      classes: this.countClasses(content),
      imports: this.countImports(content),
      exports: this.countExports(content),
      complexity: 0,
      suggestions: []
    };
    
    // Calculate complexity score
    analysis.complexity = this.calculateComplexity(analysis);
    
    // Generate suggestions
    analysis.suggestions = this.generateSuggestions(analysis, content);
    
    return analysis;
  }

  private countFunctions(content: string): number {
    const functionPatterns = [
      /function\s+\w+\s*\(/g,
      /\w+\s*:\s*function\s*\(/g,
      /\w+\s*=\s*function\s*\(/g,
      /\w+\s*=\s*\([^)]*\)\s*=>/g,
      /\w+\s*:\s*\([^)]*\)\s*=>/g,
      /async\s+\w+\s*\(/g,
      /export\s+(async\s+)?function\s+\w+/g
    ];
    
    let count = 0;
    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    
    return count;
  }

  private countClasses(content: string): number {
    const classPattern = /class\s+\w+/g;
    const matches = content.match(classPattern);
    return matches ? matches.length : 0;
  }

  private countImports(content: string): number {
    const importPattern = /^import\s+.+from\s+['"].+['"]/gm;
    const matches = content.match(importPattern);
    return matches ? matches.length : 0;
  }

  private countExports(content: string): number {
    const exportPattern = /^export\s+/gm;
    const matches = content.match(exportPattern);
    return matches ? matches.length : 0;
  }

  private calculateComplexity(analysis: FileAnalysis): number {
    let score = 0;
    
    // Size complexity
    if (analysis.lines > 500) score += 3;
    else if (analysis.lines > 300) score += 2;
    else if (analysis.lines > 200) score += 1;
    
    // Function complexity
    if (analysis.functions > 20) score += 3;
    else if (analysis.functions > 10) score += 2;
    else if (analysis.functions > 5) score += 1;
    
    // Import complexity
    if (analysis.imports > 30) score += 2;
    else if (analysis.imports > 20) score += 1;
    
    // Mixed responsibilities
    if (analysis.classes > 0 && analysis.functions > 10) score += 2;
    
    return score;
  }

  private generateSuggestions(analysis: FileAnalysis, content: string): string[] {
    const suggestions: string[] = [];
    const filename = path.basename(analysis.path);
    
    // Check for mixed responsibilities
    if (filename.includes('routes') || filename.includes('controller')) {
      if (content.includes('db.query') || content.includes('database')) {
        suggestions.push('Move database queries to a repository/service layer');
      }
      if (content.includes('validate') || content.includes('joi') || content.includes('zod')) {
        suggestions.push('Extract validation logic to separate validator files');
      }
    }
    
    // Check for monolithic service files
    if (filename.includes('service') && analysis.functions > 10) {
      suggestions.push('Split into domain-specific services');
    }
    
    // Check for large route files
    if (filename.includes('routes') && analysis.lines > 200) {
      suggestions.push('Split routes by resource or feature');
      suggestions.push('Extract route handlers to controller files');
    }
    
    // Check for utility dumps
    if (filename.includes('utils') || filename.includes('helpers')) {
      suggestions.push('Group utilities by domain (e.g., dateUtils, stringUtils)');
    }
    
    // Check for mixed middleware
    if (filename.includes('middleware') && analysis.functions > 5) {
      suggestions.push('Split middleware by concern (auth, validation, logging)');
    }
    
    return suggestions;
  }

  private reportFindings(analyses: FileAnalysis[]): void {
    // Sort by complexity
    analyses.sort((a, b) => b.complexity - a.complexity);
    
    console.log(`## 📊 Large File Analysis\n`);
    console.log(`Found ${analyses.length} large files\n`);
    
    // High complexity files
    const highComplexity = analyses.filter(a => a.complexity >= 5);
    if (highComplexity.length > 0) {
      console.log('### 🔴 High Complexity Files (Need Immediate Attention)\n');
      this.printFileList(highComplexity);
    }
    
    // Medium complexity files
    const mediumComplexity = analyses.filter(a => a.complexity >= 3 && a.complexity < 5);
    if (mediumComplexity.length > 0) {
      console.log('### 🟡 Medium Complexity Files\n');
      this.printFileList(mediumComplexity.slice(0, 10));
    }
    
    // Summary statistics
    console.log('### 📈 Summary Statistics\n');
    const totalLines = analyses.reduce((sum, a) => sum + a.lines, 0);
    const totalSize = analyses.reduce((sum, a) => sum + a.size, 0);
    
    console.log(`- Total lines: ${totalLines.toLocaleString()}`);
    console.log(`- Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Average file size: ${(totalSize / analyses.length / 1024).toFixed(2)} KB`);
    console.log(`- Average lines per file: ${Math.round(totalLines / analyses.length)}`);
  }

  private printFileList(files: FileAnalysis[]): void {
    for (const file of files) {
      console.log(`#### ${path.relative(process.cwd(), file.path)}`);
      console.log(`- Size: ${(file.size / 1024).toFixed(2)} KB (${file.lines} lines)`);
      console.log(`- Functions: ${file.functions}, Classes: ${file.classes}`);
      console.log(`- Complexity score: ${file.complexity}/10`);
      
      if (file.suggestions.length > 0) {
        console.log('- Suggestions:');
        file.suggestions.forEach(s => console.log(`  - ${s}`));
      }
      console.log('');
    }
  }

  private generateRefactoringPlan(analyses: FileAnalysis[]): void {
    console.log('## 🛠️  Refactoring Plan\n');
    
    // Group files by type
    const routeFiles = analyses.filter(a => a.path.includes('routes'));
    const serviceFiles = analyses.filter(a => a.path.includes('service'));
    const middlewareFiles = analyses.filter(a => a.path.includes('middleware'));
    
    if (routeFiles.length > 0) {
      console.log('### Route Files Refactoring\n');
      console.log('1. Create a consistent structure:');
      console.log('   ```');
      console.log('   routes/');
      console.log('     [resource]/');
      console.log('       index.ts       (route definitions)');
      console.log('       controller.ts  (business logic)');
      console.log('       validator.ts   (input validation)');
      console.log('       types.ts       (TypeScript types)');
      console.log('   ```\n');
    }
    
    if (serviceFiles.length > 0) {
      console.log('### Service Files Refactoring\n');
      console.log('1. Apply Single Responsibility Principle');
      console.log('2. Extract common patterns to base classes');
      console.log('3. Use dependency injection for better testing\n');
    }
    
    console.log('### Automated Refactoring Commands\n');
    console.log('```bash');
    console.log('# Extract controllers from routes');
    console.log('npm run refactor:extract-controllers');
    console.log('');
    console.log('# Split large service files');
    console.log('npm run refactor:split-services');
    console.log('');
    console.log('# Generate module structure');
    console.log('npm run refactor:modularize');
    console.log('```');
  }
}

// Run the analyzer
const analyzer = new LargeFileAnalyzer();
const rootDir = path.join(__dirname, '../..');

analyzer.analyze(rootDir).catch(console.error);
