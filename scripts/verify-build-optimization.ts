#!/usr/bin/env tsx

/**
 * Build Optimization Verification Script
 * 
 * This script verifies that the build optimizations implemented in Ticket 3
 * are working correctly:
 * 
 * 1. Parallel build scripts (web + server)
 * 2. ADF worker build
 * 3. Postinstall hook functionality
 * 4. Health check endpoints
 * 5. Package.json structure
 */

import { execSync } from 'child_process';
import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

interface BuildVerificationResult {
  step: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class BuildOptimizationVerifier {
  private results: BuildVerificationResult[] = [];
  private startTime: number = Date.now();

  constructor() {
    console.log('🔍 Starting Build Optimization Verification...\n');
  }

  private addResult(step: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any): void {
    this.results.push({ step, status, message, details });
    
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${step}: ${message}`);
    
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
  }

  /**
   * Verify package.json structure and scripts
   */
  private verifyPackageJson(): void {
    console.log('\n📦 Verifying package.json structure...');
    
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      
      // Check for required scripts
      const requiredScripts = [
        'postinstall',
        'build',
        'build:web',
        'build:server',
        'build:adf-worker',
        'start:adf-worker',
        'health:worker',
        'pkg:fix',
        'pkg:audit'
      ];
      
      const missingScripts: string[] = [];
      const presentScripts: string[] = [];
      
      for (const script of requiredScripts) {
        if (packageJson.scripts?.[script]) {
          presentScripts.push(script);
        } else {
          missingScripts.push(script);
        }
      }
      
      if (missingScripts.length === 0) {
        this.addResult(
          'Package Scripts',
          'pass',
          'All required build optimization scripts are present',
          { presentScripts }
        );
      } else {
        this.addResult(
          'Package Scripts',
          'fail',
          'Missing required scripts',
          { missingScripts, presentScripts }
        );
      }
      
      // Verify postinstall hook
      if (packageJson.scripts?.postinstall === 'npm run build') {
        this.addResult(
          'Postinstall Hook',
          'pass',
          'Postinstall hook correctly configured'
        );
      } else {
        this.addResult(
          'Postinstall Hook',
          'fail',
          'Postinstall hook not configured correctly',
          { current: packageJson.scripts?.postinstall }
        );
      }
      
    } catch (error) {
      this.addResult(
        'Package JSON',
        'fail',
        'Failed to read or parse package.json',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Test build scripts
   */
  private async testBuildScripts(): Promise<void> {
    console.log('\n🔨 Testing build scripts...');
    
    // Clean first
    try {
      execSync('npm run clean', { stdio: 'pipe' });
      this.addResult('Clean', 'pass', 'Clean script executed successfully');
    } catch (error) {
      this.addResult('Clean', 'warning', 'Clean script failed (may be expected)');
    }
    
    // Test individual build scripts
    const buildScripts = [
      { name: 'build:web', description: 'Frontend build' },
      { name: 'build:server', description: 'Server build (includes ADF worker)' }
    ];
    
    for (const { name, description } of buildScripts) {
      try {
        const startTime = Date.now();
        execSync(`npm run ${name}`, { stdio: 'pipe' });
        const duration = Date.now() - startTime;
        
        this.addResult(
          description,
          'pass',
          `${name} completed successfully`,
          { duration: `${duration}ms` }
        );
      } catch (error) {
        this.addResult(
          description,
          'fail',
          `${name} failed`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }
  }

  /**
   * Verify build outputs
   */
  private verifyBuildOutputs(): void {
    console.log('\n📁 Verifying build outputs...');
    
    const expectedFiles = [
      { path: 'dist/index.js', description: 'Main server bundle' },
      { path: 'dist/adf-worker.js', description: 'ADF worker bundle' },
      { path: 'dist/public/index.html', description: 'Frontend build output' }
    ];
    
    for (const { path, description } of expectedFiles) {
      if (existsSync(path)) {
        const stats = statSync(path);
        this.addResult(
          description,
          'pass',
          `${path} exists`,
          { size: `${Math.round(stats.size / 1024)}KB`, modified: stats.mtime }
        );
      } else {
        this.addResult(
          description,
          'fail',
          `${path} not found`
        );
      }
    }
  }

  /**
   * Verify ADF worker entry point
   */
  private verifyAdfWorker(): void {
    console.log('\n🤖 Verifying ADF worker...');
    
    const workerPath = 'server/adf-worker.ts';
    
    if (existsSync(workerPath)) {
      try {
        const content = readFileSync(workerPath, 'utf-8');
        
        // Check for required components
        const requiredComponents = [
          '/healthz',
          '/live',
          '/ready',
          'gracefulShutdown',
          'startHealthLogging',
          'adfService',
          'adfEmailListener'
        ];
        
        const missingComponents: string[] = [];
        const presentComponents: string[] = [];
        
        for (const component of requiredComponents) {
          if (content.includes(component)) {
            presentComponents.push(component);
          } else {
            missingComponents.push(component);
          }
        }
        
        if (missingComponents.length === 0) {
          this.addResult(
            'ADF Worker Components',
            'pass',
            'All required components present in ADF worker',
            { presentComponents }
          );
        } else {
          this.addResult(
            'ADF Worker Components',
            'warning',
            'Some components missing from ADF worker',
            { missingComponents, presentComponents }
          );
        }
        
      } catch (error) {
        this.addResult(
          'ADF Worker Content',
          'fail',
          'Failed to read ADF worker file',
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    } else {
      this.addResult(
        'ADF Worker File',
        'fail',
        'ADF worker file not found'
      );
    }
  }

  /**
   * Test package maintenance scripts
   */
  private testMaintenanceScripts(): void {
    console.log('\n🔧 Testing maintenance scripts...');
    
    const maintenanceScripts = [
      { name: 'pkg:fix', description: 'Package fix' },
      { name: 'pkg:audit', description: 'Package audit' }
    ];
    
    for (const { name, description } of maintenanceScripts) {
      try {
        execSync(`npm run ${name}`, { stdio: 'pipe' });
        this.addResult(
          description,
          'pass',
          `${name} executed successfully`
        );
      } catch (error) {
        // pkg:audit might fail if there are vulnerabilities, which is expected
        const status = name === 'pkg:audit' ? 'warning' : 'fail';
        this.addResult(
          description,
          status,
          `${name} completed with issues`,
          { note: name === 'pkg:audit' ? 'Audit failures may indicate security vulnerabilities' : undefined }
        );
      }
    }
  }

  /**
   * Generate summary report
   */
  private generateSummary(): void {
    const totalTime = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 BUILD OPTIMIZATION VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📋 Total Checks: ${this.results.length}`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED CHECKS:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  • ${r.step}: ${r.message}`));
    }
    
    if (warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results
        .filter(r => r.status === 'warning')
        .forEach(r => console.log(`  • ${r.step}: ${r.message}`));
    }
    
    const overallStatus = failed === 0 ? 'PASS' : 'FAIL';
    console.log(`\n🎯 Overall Status: ${overallStatus}`);
    
    if (overallStatus === 'PASS') {
      console.log('\n🎉 All build optimizations are working correctly!');
    } else {
      console.log('\n🔧 Some build optimizations need attention.');
    }
  }

  /**
   * Run all verification steps
   */
  public async run(): Promise<void> {
    try {
      this.verifyPackageJson();
      await this.testBuildScripts();
      this.verifyBuildOutputs();
      this.verifyAdfWorker();
      this.testMaintenanceScripts();
      
    } catch (error) {
      console.error('❌ Verification failed with error:', error);
    } finally {
      this.generateSummary();
    }
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new BuildOptimizationVerifier();
  verifier.run().catch(console.error);
}

export { BuildOptimizationVerifier };
