#!/usr/bin/env tsx

/**
 * CURRENT STRUCTURE ANALYSIS
 * 
 * Analyzes the current codebase structure and identifies issues
 */

import fs from 'fs';
import path from 'path';

class StructureAnalyzer {
  private log(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const prefix = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[type];
    console.log(`${prefix} ${message}`);
  }

  private analyzePackageJsonConflict() {
    this.log('\n=== PACKAGE.JSON ANALYSIS ===', 'info');
    
    const mainExists = fs.existsSync('package.json');
    const cleanrylieExists = fs.existsSync('package.json.cleanrylie');
    
    if (mainExists && cleanrylieExists) {
      const main = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const cleanrylie = JSON.parse(fs.readFileSync('package.json.cleanrylie', 'utf8'));
      
      this.log('❌ CONFLICT: Multiple package.json files found', 'error');
      this.log(`   - package.json: "${main.name}" (${Object.keys(main.scripts || {}).length} scripts)`, 'warn');
      this.log(`   - package.json.cleanrylie: "${cleanrylie.name}" (${Object.keys(cleanrylie.scripts || {}).length} scripts)`, 'warn');
      
      // Check for different dependencies
      const mainDeps = Object.keys(main.dependencies || {});
      const cleanrylieDeps = Object.keys(cleanrylie.dependencies || {});
      const uniqueToMain = mainDeps.filter(dep => !cleanrylieDeps.includes(dep));
      const uniqueToCleanrylie = cleanrylieDeps.filter(dep => !mainDeps.includes(dep));
      
      if (uniqueToMain.length > 0) {
        this.log(`   - Unique to main: ${uniqueToMain.slice(0, 5).join(', ')}${uniqueToMain.length > 5 ? '...' : ''}`, 'warn');
      }
      if (uniqueToCleanrylie.length > 0) {
        this.log(`   - Unique to cleanrylie: ${uniqueToCleanrylie.slice(0, 5).join(', ')}${uniqueToCleanrylie.length > 5 ? '...' : ''}`, 'warn');
      }
    } else {
      this.log('✅ Single package.json found', 'success');
    }
  }

  private analyzeDocumentationSprawl() {
    this.log('\n=== DOCUMENTATION ANALYSIS ===', 'info');
    
    // Count markdown files in root
    const rootMdFiles = fs.readdirSync('.')
      .filter(file => file.endsWith('.md'))
      .filter(file => file !== 'README.md');
    
    // Count markdown files in docs
    let docsMdFiles: string[] = [];
    if (fs.existsSync('docs')) {
      const walkDir = (dir: string): string[] => {
        const files: string[] = [];
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            files.push(...walkDir(fullPath));
          } else if (item.endsWith('.md')) {
            files.push(fullPath);
          }
        });
        return files;
      };
      docsMdFiles = walkDir('docs');
    }
    
    this.log(`📄 Documentation files found:`, 'info');
    this.log(`   - Root directory: ${rootMdFiles.length} files`, rootMdFiles.length > 10 ? 'warn' : 'info');
    this.log(`   - Docs directory: ${docsMdFiles.length} files`, 'info');
    
    if (rootMdFiles.length > 10) {
      this.log('❌ ISSUE: Too many documentation files in root directory', 'error');
      this.log(`   Sample files: ${rootMdFiles.slice(0, 5).join(', ')}...`, 'warn');
    }
    
    // Analyze file naming patterns
    const ticketFiles = [...rootMdFiles, ...docsMdFiles].filter(file => 
      file.includes('STAB-') || file.includes('TICKET_') || file.includes('ADF-')
    );
    
    if (ticketFiles.length > 0) {
      this.log(`   - Ticket/Summary files: ${ticketFiles.length}`, 'warn');
    }
  }

  private analyzeProjectNaming() {
    this.log('\n=== PROJECT NAMING ANALYSIS ===', 'info');
    
    const namingIssues: string[] = [];
    
    // Check package.json names
    if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      namingIssues.push(`package.json: "${pkg.name}"`);
    }
    
    if (fs.existsSync('package.json.cleanrylie')) {
      const pkg = JSON.parse(fs.readFileSync('package.json.cleanrylie', 'utf8'));
      namingIssues.push(`package.json.cleanrylie: "${pkg.name}"`);
    }
    
    // Check README
    if (fs.existsSync('README.md')) {
      const readme = fs.readFileSync('README.md', 'utf8');
      if (readme.includes('rylie-seo')) namingIssues.push('README.md contains "rylie-seo"');
      if (readme.includes('cleanrylie')) namingIssues.push('README.md contains "cleanrylie"');
    }
    
    // Check client HTML
    if (fs.existsSync('client/index.html')) {
      const html = fs.readFileSync('client/index.html', 'utf8');
      if (html.includes('Rylie')) namingIssues.push('client/index.html contains "Rylie"');
    }
    
    if (namingIssues.length > 1) {
      this.log('❌ ISSUE: Inconsistent project naming', 'error');
      namingIssues.forEach(issue => this.log(`   - ${issue}`, 'warn'));
    } else {
      this.log('✅ Project naming appears consistent', 'success');
    }
  }

  private analyzeDirectoryStructure() {
    this.log('\n=== DIRECTORY STRUCTURE ANALYSIS ===', 'info');
    
    const expectedDirs = ['client', 'server', 'shared', 'docs', 'scripts', 'test'];
    const actualDirs = fs.readdirSync('.').filter(item => 
      fs.statSync(item).isDirectory() && !item.startsWith('.') && item !== 'node_modules'
    );
    
    this.log(`📁 Top-level directories (${actualDirs.length}):`, 'info');
    actualDirs.forEach(dir => {
      const isExpected = expectedDirs.includes(dir);
      this.log(`   - ${dir}`, isExpected ? 'success' : 'warn');
    });
    
    // Check for unusual directories
    const unusualDirs = actualDirs.filter(dir => 
      !expectedDirs.includes(dir) && 
      !['packages', 'config', 'migrations', 'monitoring', 'cypress', 'helm', 'etl', 'tools', 'validation', 'assets', 'examples', 'prompts', 'stories', 'types', 'apps', 'integration-dashboard', 'database', 'db'].includes(dir)
    );
    
    if (unusualDirs.length > 0) {
      this.log(`❌ ISSUE: Unusual top-level directories found:`, 'error');
      unusualDirs.forEach(dir => this.log(`   - ${dir}`, 'warn'));
    }
  }

  private analyzeConfigurationFiles() {
    this.log('\n=== CONFIGURATION FILES ANALYSIS ===', 'info');
    
    const configFiles = fs.readdirSync('.')
      .filter(file => 
        file.includes('config') || 
        file.startsWith('.') ||
        file.includes('tsconfig') ||
        file.endsWith('.json') ||
        file.endsWith('.js') ||
        file.endsWith('.ts') && !file.includes('/')
      )
      .filter(file => !file.includes('node_modules'));
    
    this.log(`⚙️ Configuration files in root (${configFiles.length}):`, 'info');
    configFiles.forEach(file => {
      this.log(`   - ${file}`, 'info');
    });
    
    // Check for multiple tsconfig files
    const tsconfigFiles = configFiles.filter(file => file.includes('tsconfig'));
    if (tsconfigFiles.length > 1) {
      this.log(`❌ ISSUE: Multiple TypeScript config files:`, 'error');
      tsconfigFiles.forEach(file => this.log(`   - ${file}`, 'warn'));
    }
  }

  private analyzeTestFrameworks() {
    this.log('\n=== TEST FRAMEWORK ANALYSIS ===', 'info');
    
    if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      const testFrameworks = ['jest', 'vitest', 'mocha', 'jasmine', 'ava'];
      const foundFrameworks = testFrameworks.filter(framework => allDeps[framework]);
      
      if (foundFrameworks.length > 1) {
        this.log(`❌ ISSUE: Multiple test frameworks detected:`, 'error');
        foundFrameworks.forEach(framework => this.log(`   - ${framework}`, 'warn'));
      } else if (foundFrameworks.length === 1) {
        this.log(`✅ Single test framework: ${foundFrameworks[0]}`, 'success');
      } else {
        this.log(`⚠️ No test frameworks detected`, 'warn');
      }
    }
  }

  private generateRecommendations() {
    this.log('\n=== RECOMMENDATIONS ===', 'info');
    
    this.log('🎯 Priority Actions:', 'info');
    this.log('   1. Resolve package.json conflict', 'warn');
    this.log('   2. Standardize project naming to "seorylie"', 'warn');
    this.log('   3. Organize documentation files', 'warn');
    this.log('   4. Consolidate configuration files', 'warn');
    this.log('   5. Standardize on single test framework', 'warn');
    
    this.log('\n🚀 Next Steps:', 'info');
    this.log('   Run: tsx scripts/restructure-codebase.ts', 'success');
    this.log('   Or run phases individually:', 'info');
    this.log('   - tsx scripts/restructure-phase1.ts', 'info');
    this.log('   - tsx scripts/restructure-phase2.ts', 'info');
  }

  public analyze() {
    this.log('🔍 SEORYLIE CODEBASE STRUCTURE ANALYSIS', 'info');
    this.log('Analyzing current structure and identifying issues...', 'info');
    
    this.analyzePackageJsonConflict();
    this.analyzeDocumentationSprawl();
    this.analyzeProjectNaming();
    this.analyzeDirectoryStructure();
    this.analyzeConfigurationFiles();
    this.analyzeTestFrameworks();
    this.generateRecommendations();
    
    this.log('\n✅ Analysis complete!', 'success');
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new StructureAnalyzer();
  analyzer.analyze();
}

export default StructureAnalyzer;
