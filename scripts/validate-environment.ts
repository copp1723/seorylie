#!/usr/bin/env tsx

/**
 * Comprehensive Environment Validation Script
 * 
 * This script validates all environment variables and configuration
 * required for the Rylie AI platform to run properly.
 * 
 * Usage:
 *   npx tsx scripts/validate-environment.ts
 *   npm run env:validate
 */

import { config } from 'dotenv';
import { db, checkDatabaseConnection } from '../server/db';
import { sql } from 'drizzle-orm';
import logger from '../server/utils/logger';
import chalk from 'chalk';

// Load environment variables
config();

interface ValidationResult {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
}

class EnvironmentValidator {
  private results: ValidationResult[] = [];

  /**
   * Add a validation result
   */
  private addResult(category: string, status: 'pass' | 'fail' | 'warning', message: string, details?: string[]) {
    this.results.push({ category, status, message, details });
  }

  /**
   * Validate required environment variables
   */
  validateRequiredVariables(): void {
    console.log(chalk.blue('🔍 Validating Required Environment Variables...'));

    const requiredVars = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'OPENAI_API_KEY',
      'SENDGRID_API_KEY'
    ];

    const missing: string[] = [];
    const present: string[] = [];
    const warnings: string[] = [];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missing.push(varName);
      } else if (value.includes('your-') || value.includes('-here') || value.includes('change-me')) {
        warnings.push(`${varName} has placeholder value`);
        present.push(varName);
      } else {
        present.push(varName);
      }
    }

    if (missing.length === 0) {
      this.addResult(
        'Required Variables',
        'pass',
        `All ${requiredVars.length} required environment variables are set`,
        present
      );
    } else {
      this.addResult(
        'Required Variables',
        'fail',
        `Missing ${missing.length} required environment variables`,
        missing
      );
    }

    if (warnings.length > 0) {
      this.addResult(
        'Variable Warnings',
        'warning',
        'Some variables have placeholder values',
        warnings
      );
    }
  }

  /**
   * Validate optional environment variables
   */
  validateOptionalVariables(): void {
    console.log(chalk.blue('🔍 Validating Optional Environment Variables...'));

    const optionalVars = [
      'REPLIT_DOMAINS',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'REDIS_HOST',
      'EMAIL_SERVICE',
      'CREDENTIALS_ENCRYPTION_KEY'
    ];

    const configured: string[] = [];
    const warnings: string[] = [];

    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value) {
        if (value.includes('your-') || value.includes('here') || value.includes('change-me')) {
          warnings.push(`${varName} has placeholder value`);
        } else {
          configured.push(varName);
        }
      }
    }

    this.addResult(
      'Optional Variables',
      'pass',
      `${configured.length} optional variables configured`,
      configured
    );

    if (warnings.length > 0) {
      this.addResult(
        'Optional Warnings',
        'warning',
        'Some optional variables have placeholder values',
        warnings
      );
    }
  }

  /**
   * Validate environment-specific settings
   */
  validateEnvironmentSettings(): void {
    console.log(chalk.blue('🔍 Validating Environment Settings...'));

    const nodeEnv = process.env.NODE_ENV || 'development';
    const validEnvs = ['development', 'production', 'test'];

    if (!validEnvs.includes(nodeEnv)) {
      this.addResult(
        'Environment',
        'warning',
        `NODE_ENV "${nodeEnv}" is not a standard value`,
        [`Expected: ${validEnvs.join(', ')}`]
      );
    } else {
      this.addResult(
        'Environment',
        'pass',
        `NODE_ENV is set to "${nodeEnv}"`
      );
    }

    // Validate production-specific requirements
    if (nodeEnv === 'production') {
      const productionWarnings: string[] = [];

      if (process.env.AUTH_BYPASS === 'true' || process.env.ALLOW_AUTH_BYPASS === 'true') {
        productionWarnings.push('Authentication bypass is enabled in production');
      }

      if (process.env.CREDENTIALS_ENCRYPTION_KEY === 'default-key-change-in-production') {
        productionWarnings.push('Using default encryption key in production');
      }

      if (productionWarnings.length > 0) {
        this.addResult(
          'Production Security',
          'fail',
          'Security issues detected in production environment',
          productionWarnings
        );
      } else {
        this.addResult(
          'Production Security',
          'pass',
          'Production security settings are properly configured'
        );
      }
    }
  }

  /**
   * Validate service-specific configurations
   */
  validateServiceConfigurations(): void {
    console.log(chalk.blue('🔍 Validating Service Configurations...'));

    // OpenAI API key format validation
    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (openaiKey && openaiKey.startsWith('sk-') && openaiKey.length > 20) {
      this.addResult('OpenAI', 'pass', 'OpenAI API key format looks valid');
    } else if (openaiKey) {
      this.addResult('OpenAI', 'warning', 'OpenAI API key format may be invalid');
    }

    // SendGrid API key validation
    const sendgridKey = process.env.SENDGRID_API_KEY || '';
    if (sendgridKey && sendgridKey.length > 20 && !sendgridKey.includes('your-')) {
      this.addResult('SendGrid', 'pass', 'SendGrid API key format looks valid');
    } else if (sendgridKey) {
      this.addResult('SendGrid', 'warning', 'SendGrid API key format may be invalid');
    }

    // Email service configuration
    const emailService = process.env.EMAIL_SERVICE || 'sendgrid';
    const validEmailServices = ['sendgrid', 'gmail', 'smtp'];
    
    if (validEmailServices.includes(emailService)) {
      this.addResult('Email Service', 'pass', `Email service set to "${emailService}"`);
    } else {
      this.addResult('Email Service', 'warning', `Unknown email service "${emailService}"`);
    }
  }

  /**
   * Test database connectivity
   */
  async validateDatabaseConnection(): Promise<void> {
    console.log(chalk.blue('🔍 Testing Database Connection...'));

    try {
      const isConnected = await checkDatabaseConnection();
      
      if (isConnected) {
        // Test basic query
        const result = await db.execute(sql`SELECT 1 as test`);
        
        this.addResult(
          'Database Connection',
          'pass',
          'Database connection successful'
        );

        // Check for required tables
        const tables = await db.execute(sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);

        const requiredTables = ['sessions', 'users', 'dealerships', 'vehicles', 'personas', 'api_keys'];
        const existingTables = tables.map((row: any) => row.table_name);
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));

        if (missingTables.length === 0) {
          this.addResult(
            'Database Schema',
            'pass',
            'All required tables exist'
          );
        } else {
          this.addResult(
            'Database Schema',
            'warning',
            `Missing ${missingTables.length} required tables`,
            missingTables
          );
        }

      } else {
        this.addResult(
          'Database Connection',
          'fail',
          'Database connection failed'
        );
      }
    } catch (error: any) {
      this.addResult(
        'Database Connection',
        'fail',
        'Database connection error',
        [error.message]
      );
    }
  }

  /**
   * Print validation results
   */
  printResults(): void {
    console.log('\n' + chalk.bold('🔍 ENVIRONMENT VALIDATION RESULTS'));
    console.log('='.repeat(50));

    let hasFailures = false;
    let hasWarnings = false;

    for (const result of this.results) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      const color = result.status === 'pass' ? chalk.green : result.status === 'warning' ? chalk.yellow : chalk.red;
      
      console.log(`\n${icon} ${chalk.bold(result.category)}`);
      console.log(`   ${color(result.message)}`);
      
      if (result.details && result.details.length > 0) {
        result.details.forEach(detail => {
          console.log(`   • ${detail}`);
        });
      }

      if (result.status === 'fail') hasFailures = true;
      if (result.status === 'warning') hasWarnings = true;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (hasFailures) {
      console.log(chalk.red.bold('❌ VALIDATION FAILED'));
      console.log(chalk.red('   Some critical issues need to be resolved before deployment.'));
    } else if (hasWarnings) {
      console.log(chalk.yellow.bold('⚠️  VALIDATION PASSED WITH WARNINGS'));
      console.log(chalk.yellow('   Consider addressing the warnings for optimal configuration.'));
    } else {
      console.log(chalk.green.bold('✅ VALIDATION PASSED'));
      console.log(chalk.green('   Environment is properly configured.'));
    }

    console.log('\n📋 NEXT STEPS:');
    if (hasFailures) {
      console.log('1. Fix the failed validations above');
      console.log('2. Re-run this validation script');
    } else {
      console.log('1. Run database setup if needed: npm run db:setup');
      console.log('2. Start the application: npm run dev');
    }
  }

  /**
   * Run all validations
   */
  async runAll(): Promise<void> {
    console.log(chalk.bold.blue('🚀 Starting Environment Validation\n'));

    this.validateRequiredVariables();
    this.validateOptionalVariables();
    this.validateEnvironmentSettings();
    this.validateServiceConfigurations();
    await this.validateDatabaseConnection();

    this.printResults();
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new EnvironmentValidator();
  
  validator.runAll()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red('❌ Validation script failed:'), error);
      process.exit(1);
    });
}

export { EnvironmentValidator };
