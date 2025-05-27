#!/usr/bin/env tsx

/**
 * Comprehensive Deployment Readiness Check
 * Validates all aspects of the application before deployment
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { checkDatabaseConnection } from '../server/db';
import logger from '../server/utils/logger';
import { migrationRunner } from '../server/utils/migration-runner';

// Load environment variables from .env file
config();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
}

class DeploymentReadinessChecker {
  private results: CheckResult[] = [];

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: string[]) {
    this.results.push({ name, status, message, details });
  }

  private getStatusIcon(status: 'pass' | 'fail' | 'warning'): string {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
    }
  }

  async checkEnvironmentVariables(): Promise<void> {
    console.log('🔍 Checking Environment Variables...');

    const requiredVars = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'OPENAI_API_KEY',
      'SENDGRID_API_KEY'
    ];

    const optionalVars = [
      'REPLIT_DOMAINS',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'REDIS_HOST'
    ];

    const missing: string[] = [];
    const present: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value || value.trim() === '' || value.includes('your-') || value.includes('-here')) {
        missing.push(varName);
      } else {
        present.push(varName);
      }
    }

    // Check optional variables
    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value && (value.includes('your-') || value.includes('here'))) {
        warnings.push(`${varName} has placeholder value`);
      }
    }

    if (missing.length === 0) {
      this.addResult(
        'Environment Variables',
        'pass',
        `All ${requiredVars.length} required environment variables are set`,
        present
      );
    } else {
      this.addResult(
        'Environment Variables',
        'fail',
        `Missing ${missing.length} required environment variables`,
        missing
      );
    }

    if (warnings.length > 0) {
      this.addResult(
        'Environment Warnings',
        'warning',
        'Some variables have placeholder values',
        warnings
      );
    }
  }

  async checkDatabaseConnection(): Promise<void> {
    console.log('🔍 Checking Database Connection...');

    try {
      const isConnected = await checkDatabaseConnection();
      if (isConnected) {
        this.addResult(
          'Database Connection',
          'pass',
          'Database connection successful'
        );
      } else {
        this.addResult(
          'Database Connection',
          'fail',
          'Database connection failed'
        );
      }
    } catch (error) {
      const err = error as Error;
      this.addResult(
        'Database Connection',
        'fail',
        'Database connection error',
        [err.message]
      );
    }
  }

  async checkMigrations(): Promise<void> {
    console.log('🔍 Checking Database Migrations...');

    try {
      const status = await migrationRunner.status();

      if (status.pendingCount === 0) {
        this.addResult(
          'Database Migrations',
          'pass',
          `All migrations applied (${status.appliedCount} total)`
        );
      } else {
        this.addResult(
          'Database Migrations',
          'warning',
          `${status.pendingCount} pending migrations found`,
          status.pendingMigrations.map(m => m.filename)
        );
      }

      // Validate migration files
      const validation = await migrationRunner.validate();
      if (validation.valid) {
        this.addResult(
          'Migration Files',
          'pass',
          'All migration files are valid'
        );
      } else {
        this.addResult(
          'Migration Files',
          'fail',
          'Migration file validation failed',
          validation.errors
        );
      }
    } catch (error) {
      const err = error as Error;
      this.addResult(
        'Database Migrations',
        'fail',
        'Migration check failed',
        [err.message]
      );
    }
  }

  async checkRequiredFiles(): Promise<void> {
    console.log('🔍 Checking Required Files...');

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.env',
      'server/index.ts',
      'server/db.ts'
    ];

    const missing: string[] = [];
    const present: string[] = [];

    for (const file of requiredFiles) {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        present.push(file);
      } else {
        missing.push(file);
      }
    }

    if (missing.length === 0) {
      this.addResult(
        'Required Files',
        'pass',
        `All ${requiredFiles.length} required files present`,
        present
      );
    } else {
      this.addResult(
        'Required Files',
        'fail',
        `Missing ${missing.length} required files`,
        missing
      );
    }
  }

  async checkBuildConfiguration(): Promise<void> {
    console.log('🔍 Checking Build Configuration...');

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

      const requiredScripts = ['build', 'start', 'dev'];
      const missingScripts: string[] = [];

      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          missingScripts.push(script);
        }
      }

      if (missingScripts.length === 0) {
        this.addResult(
          'Build Scripts',
          'pass',
          'All required npm scripts are configured'
        );
      } else {
        this.addResult(
          'Build Scripts',
          'fail',
          'Missing required npm scripts',
          missingScripts
        );
      }

      // Check for essential dependencies
      const requiredDeps = ['express', 'drizzle-orm', 'postgres'];
      const missingDeps: string[] = [];

      for (const dep of requiredDeps) {
        if (!packageJson.dependencies?.[dep]) {
          missingDeps.push(dep);
        }
      }

      if (missingDeps.length === 0) {
        this.addResult(
          'Dependencies',
          'pass',
          'All essential dependencies are installed'
        );
      } else {
        this.addResult(
          'Dependencies',
          'fail',
          'Missing essential dependencies',
          missingDeps
        );
      }
    } catch (error) {
      const err = error as Error;
      this.addResult(
        'Build Configuration',
        'fail',
        'Failed to read package.json',
        [err.message]
      );
    }
  }

  async runAllChecks(): Promise<void> {
    console.log('🚀 Starting Deployment Readiness Check\n');
    console.log('=' .repeat(60));

    await this.checkEnvironmentVariables();
    await this.checkRequiredFiles();
    await this.checkBuildConfiguration();
    await this.checkDatabaseConnection();
    await this.checkMigrations();

    console.log('\n' + '=' .repeat(60));
    console.log('📊 DEPLOYMENT READINESS REPORT\n');

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;

    for (const result of this.results) {
      const icon = this.getStatusIcon(result.status);
      console.log(`${icon} ${result.name}: ${result.message}`);

      if (result.details && result.details.length > 0) {
        result.details.forEach(detail => {
          console.log(`   • ${detail}`);
        });
      }
      console.log();

      switch (result.status) {
        case 'pass': passCount++; break;
        case 'fail': failCount++; break;
        case 'warning': warningCount++; break;
      }
    }

    console.log('=' .repeat(60));
    console.log(`📈 SUMMARY: ${passCount} passed, ${failCount} failed, ${warningCount} warnings\n`);

    if (failCount === 0) {
      console.log('🎉 DEPLOYMENT READY! All critical checks passed.');
      if (warningCount > 0) {
        console.log('⚠️  Please review warnings before deploying.');
      }
    } else {
      console.log('🚫 NOT READY FOR DEPLOYMENT! Please fix the failed checks.');
      process.exit(1);
    }
  }
}

// Run the deployment readiness check
async function main() {
  const checker = new DeploymentReadinessChecker();
  await checker.runAllChecks();
}

main().catch(error => {
  console.error('Deployment readiness check failed:', error);
  process.exit(1);
});
