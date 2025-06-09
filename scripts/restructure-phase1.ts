#!/usr/bin/env tsx

/**
 * PHASE 1: Project Identity & Core Structure Cleanup
 * 
 * This script handles:
 * 1. Resolving package.json conflicts
 * 2. Standardizing project naming
 * 3. Creating backup of current state
 * 4. Initial directory structure setup
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const BACKUP_DIR = path.join(ROOT_DIR, '.backup-restructure');

interface PackageJson {
  name: string;
  version: string;
  description: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  [key: string]: any;
}

class Phase1Restructure {
  private log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const prefix = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[type];
    console.log(`${prefix} ${message}`);
  }

  private createBackup() {
    this.log('Creating backup of current state...', 'info');
    
    if (fs.existsSync(BACKUP_DIR)) {
      fs.rmSync(BACKUP_DIR, { recursive: true });
    }
    
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    
    // Backup critical files
    const criticalFiles = [
      'package.json',
      'package.json.cleanrylie',
      'tsconfig.json',
      'README.md',
      'pnpm-workspace.yaml'
    ];
    
    criticalFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(BACKUP_DIR, file));
        this.log(`Backed up ${file}`, 'success');
      }
    });
  }

  private analyzePackageJsonConflict(): { main: PackageJson; cleanrylie: PackageJson } {
    this.log('Analyzing package.json conflicts...', 'info');
    
    const mainPackage = JSON.parse(fs.readFileSync('package.json', 'utf8')) as PackageJson;
    const cleanryliePackage = JSON.parse(fs.readFileSync('package.json.cleanrylie', 'utf8')) as PackageJson;
    
    this.log(`Main package: ${mainPackage.name} (${mainPackage.description})`, 'info');
    this.log(`Cleanrylie package: ${cleanryliePackage.name} (${cleanryliePackage.description})`, 'info');
    
    return { main: mainPackage, cleanrylie: cleanryliePackage };
  }

  private mergePackageJson(main: PackageJson, cleanrylie: PackageJson): PackageJson {
    this.log('Merging package.json files...', 'info');
    
    // Use cleanrylie as base since it seems more complete
    const merged: PackageJson = {
      ...cleanrylie,
      name: 'seorylie', // Standardize name
      description: 'Seorylie - AI-Powered SEO & Automotive Dealership Platform',
      version: '1.0.0',
      
      // Merge scripts (cleanrylie has more comprehensive scripts)
      scripts: {
        ...main.scripts,
        ...cleanrylie.scripts,
      },
      
      // Merge dependencies
      dependencies: {
        ...main.dependencies,
        ...cleanrylie.dependencies,
      },
      
      // Merge devDependencies
      devDependencies: {
        ...main.devDependencies,
        ...cleanrylie.devDependencies,
      },
      
      // Keep workspace configuration from main
      workspaces: main.workspaces || cleanrylie.workspaces,
      private: true,
    };
    
    return merged;
  }

  private updateProjectReferences(oldName: string, newName: string) {
    this.log(`Updating references from ${oldName} to ${newName}...`, 'info');
    
    const filesToUpdate = [
      'README.md',
      'client/index.html',
      'server/index.ts',
      'docs/README.md'
    ];
    
    filesToUpdate.forEach(file => {
      if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        // Replace various forms of the old name
        content = content.replace(new RegExp(oldName, 'gi'), newName);
        content = content.replace(/rylie-seo/gi, 'seorylie');
        content = content.replace(/cleanrylie/gi, 'seorylie');
        
        fs.writeFileSync(file, content);
        this.log(`Updated references in ${file}`, 'success');
      }
    });
  }

  private createDirectoryStructure() {
    this.log('Creating new directory structure...', 'info');
    
    const newDirs = [
      'src',
      'tests/unit',
      'tests/integration', 
      'tests/e2e',
      'tests/fixtures',
      'infra/docker',
      'infra/kubernetes',
      'infra/monitoring'
    ];
    
    newDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`Created directory: ${dir}`, 'success');
      }
    });
  }

  private cleanupRootFiles() {
    this.log('Cleaning up root directory...', 'info');
    
    // Move root markdown files to appropriate locations
    const rootMarkdownFiles = fs.readdirSync('.')
      .filter(file => file.endsWith('.md') && file !== 'README.md' && file !== 'CODEBASE_RESTRUCTURE_PLAN.md')
      .slice(0, 10); // Limit to prevent overwhelming
    
    if (!fs.existsSync('docs/summaries')) {
      fs.mkdirSync('docs/summaries', { recursive: true });
    }
    
    rootMarkdownFiles.forEach(file => {
      const newPath = path.join('docs/summaries', file);
      if (!fs.existsSync(newPath)) {
        fs.renameSync(file, newPath);
        this.log(`Moved ${file} to docs/summaries/`, 'success');
      }
    });
  }

  public async execute() {
    try {
      this.log('🚀 Starting Phase 1: Project Identity & Core Structure', 'info');
      
      // Step 1: Create backup
      this.createBackup();
      
      // Step 2: Analyze and resolve package.json conflict
      const { main, cleanrylie } = this.analyzePackageJsonConflict();
      const mergedPackage = this.mergePackageJson(main, cleanrylie);
      
      // Step 3: Write new package.json
      fs.writeFileSync('package.json', JSON.stringify(mergedPackage, null, 2));
      this.log('Created unified package.json', 'success');
      
      // Step 4: Remove old package.json.cleanrylie
      fs.unlinkSync('package.json.cleanrylie');
      this.log('Removed package.json.cleanrylie', 'success');
      
      // Step 5: Update project references
      this.updateProjectReferences('rylie-seo', 'seorylie');
      
      // Step 6: Create new directory structure
      this.createDirectoryStructure();
      
      // Step 7: Clean up root files
      this.cleanupRootFiles();
      
      this.log('✅ Phase 1 completed successfully!', 'success');
      this.log('📋 Next steps:', 'info');
      this.log('  1. Review the changes', 'info');
      this.log('  2. Test the application', 'info');
      this.log('  3. Run Phase 2 when ready', 'info');
      
    } catch (error) {
      this.log(`Phase 1 failed: ${error}`, 'error');
      this.log('Backup available in .backup-restructure/', 'warn');
      throw error;
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const restructure = new Phase1Restructure();
  restructure.execute().catch(console.error);
}

export default Phase1Restructure;
