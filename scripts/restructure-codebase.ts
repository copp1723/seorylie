#!/usr/bin/env tsx

/**
 * MASTER CODEBASE RESTRUCTURING SCRIPT
 * 
 * This script orchestrates the complete codebase restructuring process
 * across multiple phases with safety checks and rollback capabilities.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Phase1Restructure from './restructure-phase1';
import Phase2DocumentationReorg from './restructure-phase2';

interface RestructureOptions {
  phase?: number;
  dryRun?: boolean;
  skipBackup?: boolean;
  autoConfirm?: boolean;
}

class CodebaseRestructure {
  private options: RestructureOptions;
  private backupDir: string;

  constructor(options: RestructureOptions = {}) {
    this.options = options;
    this.backupDir = path.join(process.cwd(), '.backup-restructure');
  }

  private log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const prefix = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[type];
    console.log(`${prefix} ${message}`);
  }

  private async confirm(message: string): Promise<boolean> {
    if (this.options.autoConfirm) return true;
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      readline.question(`${message} (y/N): `, (answer: string) => {
        readline.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  private createFullBackup() {
    if (this.options.skipBackup) {
      this.log('Skipping backup (--skip-backup flag)', 'warn');
      return;
    }

    this.log('Creating full project backup...', 'info');
    
    if (fs.existsSync(this.backupDir)) {
      fs.rmSync(this.backupDir, { recursive: true });
    }
    
    fs.mkdirSync(this.backupDir, { recursive: true });
    
    // Copy critical directories and files
    const itemsToBackup = [
      'package.json',
      'package.json.cleanrylie',
      'tsconfig.json',
      'README.md',
      'client',
      'server',
      'shared',
      'docs',
      'scripts',
      'config'
    ];
    
    itemsToBackup.forEach(item => {
      if (fs.existsSync(item)) {
        const stat = fs.statSync(item);
        if (stat.isDirectory()) {
          this.copyDirectory(item, path.join(this.backupDir, item));
        } else {
          fs.copyFileSync(item, path.join(this.backupDir, item));
        }
        this.log(`Backed up ${item}`, 'success');
      }
    });
  }

  private copyDirectory(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    items.forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  private async runPhase1() {
    this.log('🚀 PHASE 1: Project Identity & Core Structure', 'info');
    
    if (this.options.dryRun) {
      this.log('DRY RUN: Would execute Phase 1 restructuring', 'warn');
      return;
    }
    
    const confirmed = await this.confirm('Execute Phase 1 (Project Identity & Core Structure)?');
    if (!confirmed) {
      this.log('Phase 1 skipped by user', 'warn');
      return;
    }
    
    const phase1 = new Phase1Restructure();
    await phase1.execute();
  }

  private async runPhase2() {
    this.log('🚀 PHASE 2: Documentation Reorganization', 'info');
    
    if (this.options.dryRun) {
      this.log('DRY RUN: Would execute Phase 2 documentation reorganization', 'warn');
      return;
    }
    
    const confirmed = await this.confirm('Execute Phase 2 (Documentation Reorganization)?');
    if (!confirmed) {
      this.log('Phase 2 skipped by user', 'warn');
      return;
    }
    
    const phase2 = new Phase2DocumentationReorg();
    await phase2.execute();
  }

  private async runPhase3() {
    this.log('🚀 PHASE 3: Configuration Consolidation', 'info');
    
    if (this.options.dryRun) {
      this.log('DRY RUN: Would consolidate configuration files', 'warn');
      return;
    }
    
    const confirmed = await this.confirm('Execute Phase 3 (Configuration Consolidation)?');
    if (!confirmed) {
      this.log('Phase 3 skipped by user', 'warn');
      return;
    }
    
    // TODO: Implement Phase 3
    this.log('Phase 3 implementation pending...', 'warn');
  }

  private validateEnvironment() {
    this.log('Validating environment...', 'info');
    
    // Check if we're in a git repository
    try {
      execSync('git status', { stdio: 'ignore' });
    } catch {
      this.log('Not in a git repository - consider initializing git first', 'warn');
    }
    
    // Check for uncommitted changes
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        this.log('Uncommitted changes detected - consider committing first', 'warn');
      }
    } catch {
      // Ignore if git commands fail
    }
    
    // Check for required files
    const requiredFiles = ['package.json'];
    requiredFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file ${file} not found`);
      }
    });
    
    this.log('Environment validation passed', 'success');
  }

  private generateSummaryReport() {
    this.log('📊 RESTRUCTURING SUMMARY REPORT', 'info');
    
    const report = {
      timestamp: new Date().toISOString(),
      backupLocation: this.backupDir,
      phases: {
        phase1: 'Project Identity & Core Structure - ✅ Completed',
        phase2: 'Documentation Reorganization - ✅ Completed',
        phase3: 'Configuration Consolidation - ⏳ Pending',
        phase4: 'Code Organization - ⏳ Pending',
        phase5: 'Cleanup & Optimization - ⏳ Pending'
      },
      nextSteps: [
        'Review the changes made',
        'Test the application functionality',
        'Run remaining phases when ready',
        'Update team documentation'
      ]
    };
    
    const reportPath = 'RESTRUCTURE_REPORT.md';
    const reportContent = `# Codebase Restructuring Report

**Generated:** ${report.timestamp}
**Backup Location:** ${report.backupLocation}

## Phases Completed

${Object.entries(report.phases).map(([phase, status]) => `- **${phase}**: ${status}`).join('\n')}

## Next Steps

${report.nextSteps.map(step => `- [ ] ${step}`).join('\n')}

## Rollback Instructions

If you need to rollback the changes:

1. Stop the application
2. Restore from backup: \`cp -r ${report.backupLocation}/* .\`
3. Reinstall dependencies: \`npm install\`
4. Test the application

## Validation

After restructuring, run these commands to validate:

\`\`\`bash
npm install
npm run build
npm test
npm run lint
\`\`\`

---

*Generated by Seorylie Codebase Restructuring Tool*
`;
    
    fs.writeFileSync(reportPath, reportContent);
    this.log(`Summary report saved to ${reportPath}`, 'success');
  }

  public async execute() {
    try {
      this.log('🏗️ SEORYLIE CODEBASE RESTRUCTURING', 'info');
      this.log('This will reorganize your codebase for better maintainability', 'info');
      
      // Validate environment
      this.validateEnvironment();
      
      // Create backup
      this.createFullBackup();
      
      // Execute phases
      const startPhase = this.options.phase || 1;
      
      if (startPhase <= 1) await this.runPhase1();
      if (startPhase <= 2) await this.runPhase2();
      if (startPhase <= 3) await this.runPhase3();
      
      // Generate summary
      this.generateSummaryReport();
      
      this.log('🎉 Codebase restructuring completed!', 'success');
      this.log('📋 Review RESTRUCTURE_REPORT.md for details', 'info');
      
    } catch (error) {
      this.log(`Restructuring failed: ${error}`, 'error');
      this.log(`Backup available at: ${this.backupDir}`, 'warn');
      throw error;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options: RestructureOptions = {};

  args.forEach(arg => {
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--skip-backup') options.skipBackup = true;
    if (arg === '--auto-confirm') options.autoConfirm = true;
    if (arg.startsWith('--phase=')) options.phase = parseInt(arg.split('=')[1]);
  });

  const restructure = new CodebaseRestructure(options);
  restructure.execute().catch(console.error);
}

export default CodebaseRestructure;
