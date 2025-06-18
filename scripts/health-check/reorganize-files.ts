#!/usr/bin/env node
/**
 * Reorganize files into a clean, modular structure
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const rename = promisify(fs.rename);
const copyFile = promisify(fs.copyFile);

interface FileMove {
  from: string;
  to: string;
  reason: string;
}

class FileOrganizer {
  private moves: FileMove[] = [];
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async reorganize(dryRun: boolean = true): Promise<void> {
    console.log(`🏗️  Reorganizing files... (dry run: ${dryRun})\n`);
    
    // Plan the reorganization
    await this.planReorganization();
    
    // Report the plan
    this.reportPlan();
    
    if (!dryRun) {
      await this.executePlan();
    }
  }

  private async planReorganization(): Promise<void> {
    // Move loose HTML files
    await this.planHtmlMoves();
    
    // Move setup scripts
    await this.planSetupScriptMoves();
    
    // Move test files
    await this.planTestFileMoves();
    
    // Consolidate server entry points
    await this.planServerConsolidation();
    
    // Organize configuration files
    await this.planConfigMoves();
    
    // Move documentation
    await this.planDocumentationMoves();
  }

  private async planHtmlMoves(): Promise<void> {
    const htmlFiles = ['chat.html', 'dashboard.html', 'customer-app.html'];
    
    for (const file of htmlFiles) {
      const fromPath = path.join(this.rootDir, file);
      if (await this.fileExists(fromPath)) {
        this.moves.push({
          from: fromPath,
          to: path.join(this.rootDir, 'src/client/static', file),
          reason: 'Move static HTML to client directory'
        });
      }
    }
  }

  private async planSetupScriptMoves(): Promise<void> {
    const files = await readdir(this.rootDir);
    
    for (const file of files) {
      if (file.startsWith('setup-') && file.endsWith('.js')) {
        this.moves.push({
          from: path.join(this.rootDir, file),
          to: path.join(this.rootDir, 'scripts/setup', file),
          reason: 'Consolidate setup scripts'
        });
      }
    }
  }

  private async planTestFileMoves(): Promise<void> {
    const files = await readdir(this.rootDir);
    
    for (const file of files) {
      if (file.startsWith('test-') && file.endsWith('.js')) {
        this.moves.push({
          from: path.join(this.rootDir, file),
          to: path.join(this.rootDir, 'tests/integration', file),
          reason: 'Move test files to test directory'
        });
      }
    }
  }

  private async planServerConsolidation(): Promise<void> {
    // Mark duplicates for removal (keep TypeScript version)
    const duplicates = [
      'index.js',
      'server-with-db.js',
      'render-server.js'
    ];
    
    for (const file of duplicates) {
      const fromPath = path.join(this.rootDir, file);
      if (await this.fileExists(fromPath)) {
        this.moves.push({
          from: fromPath,
          to: path.join(this.rootDir, 'archive/legacy-servers', file),
          reason: 'Archive duplicate server entry point'
        });
      }
    }
  }

  private async planConfigMoves(): Promise<void> {
    const configFiles = [
      '.env.example',
      '.env.production-template',
      '.env.render.template',
      '.env.test',
      'jest.config.js',
      'tsconfig.json',
      'tsconfig.server.json',
      '.eslintrc.js',
      'postcss.config.cjs',
      'tailwind.config.ts'
    ];
    
    for (const file of configFiles) {
      const fromPath = path.join(this.rootDir, file);
      if (await this.fileExists(fromPath)) {
        const targetDir = file.startsWith('.env') ? 'config/env' : 'config';
        this.moves.push({
          from: fromPath,
          to: path.join(this.rootDir, targetDir, file),
          reason: 'Centralize configuration files'
        });
      }
    }
  }

  private async planDocumentationMoves(): Promise<void> {
    const files = await readdir(this.rootDir);
    
    for (const file of files) {
      if (file.endsWith('.md') && file !== 'README.md') {
        this.moves.push({
          from: path.join(this.rootDir, file),
          to: path.join(this.rootDir, 'docs', file),
          reason: 'Consolidate documentation'
        });
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private reportPlan(): void {
    console.log(`📋 Reorganization Plan (${this.moves.length} moves)\n`);
    
    // Group by reason
    const byReason = new Map<string, FileMove[]>();
    for (const move of this.moves) {
      if (!byReason.has(move.reason)) {
        byReason.set(move.reason, []);
      }
      byReason.get(move.reason)!.push(move);
    }
    
    for (const [reason, moves] of byReason) {
      console.log(`### ${reason} (${moves.length} files)\n`);
      
      for (const move of moves) {
        const from = path.relative(this.rootDir, move.from);
        const to = path.relative(this.rootDir, move.to);
        console.log(`  ${from} → ${to}`);
      }
      console.log('');
    }
  }

  private async executePlan(): Promise<void> {
    console.log('🚀 Executing reorganization...\n');
    
    // Create necessary directories
    const dirs = new Set<string>();
    for (const move of this.moves) {
      dirs.add(path.dirname(move.to));
    }
    
    for (const dir of dirs) {
      await this.ensureDir(dir);
    }
    
    // Execute moves
    let completed = 0;
    for (const move of this.moves) {
      try {
        await rename(move.from, move.to);
        completed++;
      } catch (error) {
        console.error(`❌ Failed to move ${move.from}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Completed ${completed}/${this.moves.length} moves`);
    
    // Generate import update script
    await this.generateImportUpdates();
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async generateImportUpdates(): Promise<void> {
    const updates: string[] = ['#!/bin/bash', '', '# Update imports after reorganization', ''];
    
    // Add sed commands to update common imports
    updates.push('# Update config imports');
    updates.push(`find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "./node_modules/*" -exec sed -i '' 's|../../../jest.config|../../../config/jest.config|g' {} \\;`);
    
    updates.push('');
    updates.push('# Update HTML references');
    updates.push(`find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "./node_modules/*" -exec sed -i '' 's|__dirname, '"'"'chat.html|__dirname, '"'"'../client/static/chat.html|g' {} \\;`);
    
    const scriptPath = path.join(this.rootDir, 'scripts/health-check/update-imports.sh');
    await writeFile(scriptPath, updates.join('\n'));
    await fs.promises.chmod(scriptPath, 0o755);
    
    console.log(`\n📝 Generated import update script: ${scriptPath}`);
  }
}

// Run the organizer
const organizer = new FileOrganizer(path.join(__dirname, '../..'));
const dryRun = !process.argv.includes('--execute');

organizer.reorganize(dryRun).catch(console.error);
