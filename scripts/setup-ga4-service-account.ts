#!/usr/bin/env node

/**
 * GA4 Service Account Setup and Verification Script
 * 
 * This script helps validate and test Google Analytics 4 service account configuration.
 * It performs the following checks:
 * 1. Validates environment variables
 * 2. Tests service account authentication
 * 3. Verifies GA4 property access
 * 4. Retrieves basic property information
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

class GA4SetupValidator {
  private propertyId: string | undefined;
  private serviceAccountKey: ServiceAccountKey | undefined;
  private analyticsDataClient: BetaAnalyticsDataClient | undefined;

  constructor() {
    this.propertyId = process.env.GA4_PROPERTY_ID;
  }

  /**
   * Main validation flow
   */
  async validate(): Promise<void> {
    console.log(chalk.blue('\n🔍 Starting GA4 Service Account Setup Validation...\n'));

    try {
      // Step 1: Validate environment variables
      this.validateEnvironmentVariables();

      // Step 2: Load and validate service account credentials
      await this.loadServiceAccountCredentials();

      // Step 3: Initialize GA4 client
      await this.initializeGA4Client();

      // Step 4: Test GA4 connection
      await this.testGA4Connection();

      // Step 5: Display summary
      this.displaySuccessSummary();

    } catch (error) {
      this.handleError(error);
      process.exit(1);
    }
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironmentVariables(): void {
    console.log(chalk.cyan('Step 1: Validating environment variables...'));

    const required = ['GA4_PROPERTY_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Check for either file path or JSON string
    if (!process.env.GA4_SERVICE_ACCOUNT_KEY_PATH && !process.env.GA4_SERVICE_ACCOUNT_KEY) {
      throw new Error('Either GA4_SERVICE_ACCOUNT_KEY_PATH or GA4_SERVICE_ACCOUNT_KEY must be set');
    }

    console.log(chalk.green('✓ Environment variables validated\n'));
  }

  /**
   * Load service account credentials from file or environment variable
   */
  private async loadServiceAccountCredentials(): Promise<void> {
    console.log(chalk.cyan('Step 2: Loading service account credentials...'));

    try {
      if (process.env.GA4_SERVICE_ACCOUNT_KEY_PATH) {
        // Load from file
        const keyPath = path.resolve(process.env.GA4_SERVICE_ACCOUNT_KEY_PATH);
        
        if (!fs.existsSync(keyPath)) {
          throw new Error(`Service account key file not found at: ${keyPath}`);
        }

        const keyContent = fs.readFileSync(keyPath, 'utf-8');
        this.serviceAccountKey = JSON.parse(keyContent);
        console.log(chalk.green(`✓ Loaded credentials from file: ${keyPath}`));
      } else if (process.env.GA4_SERVICE_ACCOUNT_KEY) {
        // Load from environment variable
        this.serviceAccountKey = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_KEY);
        console.log(chalk.green('✓ Loaded credentials from environment variable'));
      }

      // Validate key structure
      this.validateServiceAccountKey();
      console.log(chalk.green(`✓ Service account: ${this.serviceAccountKey?.client_email}\n`));

    } catch (error) {
      throw new Error(`Failed to load service account credentials: ${error.message}`);
    }
  }

  /**
   * Validate service account key structure
   */
  private validateServiceAccountKey(): void {
    if (!this.serviceAccountKey) {
      throw new Error('Service account key is not loaded');
    }

    const requiredFields = [
      'type', 'project_id', 'private_key_id', 'private_key',
      'client_email', 'client_id', 'auth_uri', 'token_uri'
    ];

    const missingFields = requiredFields.filter(field => !this.serviceAccountKey![field as keyof ServiceAccountKey]);
    
    if (missingFields.length > 0) {
      throw new Error(`Invalid service account key. Missing fields: ${missingFields.join(', ')}`);
    }

    if (this.serviceAccountKey.type !== 'service_account') {
      throw new Error(`Invalid key type: ${this.serviceAccountKey.type}. Expected 'service_account'`);
    }
  }

  /**
   * Initialize Google Analytics Data API client
   */
  private async initializeGA4Client(): Promise<void> {
    console.log(chalk.cyan('Step 3: Initializing GA4 client...'));

    try {
      const auth = new GoogleAuth({
        credentials: this.serviceAccountKey,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });

      this.analyticsDataClient = new BetaAnalyticsDataClient({
        auth: auth as any,
      });

      console.log(chalk.green('✓ GA4 client initialized successfully\n'));
    } catch (error) {
      throw new Error(`Failed to initialize GA4 client: ${error.message}`);
    }
  }

  /**
   * Test GA4 connection and retrieve property metadata
   */
  private async testGA4Connection(): Promise<void> {
    console.log(chalk.cyan('Step 4: Testing GA4 connection...'));

    try {
      // Test 1: Get property metadata
      console.log(chalk.yellow('  → Fetching property metadata...'));
      const [metadataResponse] = await this.analyticsDataClient.getMetadata({
        name: `properties/${this.propertyId}/metadata`,
      });

      console.log(chalk.green('  ✓ Successfully connected to GA4 property'));
      console.log(chalk.gray(`    Property ID: ${this.propertyId}`));

      // Test 2: Run a simple report query
      console.log(chalk.yellow('\n  → Running test query...'));
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const [reportResponse] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{
          startDate: yesterday.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
      });

      console.log(chalk.green('  ✓ Successfully retrieved data from GA4'));
      
      if (reportResponse.rows && reportResponse.rows.length > 0) {
        const activeUsers = reportResponse.rows[0].metricValues?.[0].value || '0';
        console.log(chalk.gray(`    Active users (last 24h): ${activeUsers}`));
      }

      // Test 3: List available dimensions and metrics
      console.log(chalk.yellow('\n  → Checking available dimensions and metrics...'));
      const dimensions = metadataResponse.dimensions?.length || 0;
      const metrics = metadataResponse.metrics?.length || 0;
      
      console.log(chalk.green('  ✓ Property configuration verified'));
      console.log(chalk.gray(`    Available dimensions: ${dimensions}`));
      console.log(chalk.gray(`    Available metrics: ${metrics}`));

    } catch (error: any) {
      if (error.code === 403) {
        throw new Error(
          'Permission denied. Make sure the service account has been granted access to the GA4 property.\n' +
          `Service account email: ${this.serviceAccountKey?.client_email}\n` +
          'Please follow Step 5 in the setup guide to grant access.'
        );
      } else if (error.code === 404) {
        throw new Error(
          `GA4 property not found: ${this.propertyId}\n` +
          'Please verify the property ID is correct.'
        );
      } else {
        throw new Error(`GA4 connection test failed: ${error.message}`);
      }
    }
  }

  /**
   * Display success summary
   */
  private displaySuccessSummary(): void {
    console.log(chalk.green('\n✅ GA4 Service Account Setup Validated Successfully!\n'));
    console.log(chalk.white('Configuration Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`Property ID:        ${chalk.cyan(this.propertyId)}`));
    console.log(chalk.white(`Service Account:    ${chalk.cyan(this.serviceAccountKey?.client_email)}`));
    console.log(chalk.white(`Project ID:         ${chalk.cyan(this.serviceAccountKey?.project_id)}`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('\nYour GA4 integration is ready to use! 🎉\n'));
  }

  /**
   * Handle and display errors
   */
  private handleError(error: any): void {
    console.log(chalk.red('\n❌ Validation Failed\n'));
    console.error(chalk.red(error.message));
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }

    console.log(chalk.yellow('\n💡 Troubleshooting tips:'));
    console.log(chalk.gray('1. Check the GA4_SETUP.md guide for detailed instructions'));
    console.log(chalk.gray('2. Verify all environment variables are set correctly'));
    console.log(chalk.gray('3. Ensure the service account has access to the GA4 property'));
    console.log(chalk.gray('4. Check that the Google Analytics Data API is enabled in your Google Cloud project\n'));
  }
}

/**
 * Helper function to create example .env entries
 */
function generateEnvExample(): void {
  console.log(chalk.yellow('\n📝 Example .env configuration:\n'));
  console.log(chalk.gray('# Google Analytics 4 Configuration'));
  console.log(chalk.gray('GA4_PROPERTY_ID=123456789'));
  console.log(chalk.gray('GA4_SERVICE_ACCOUNT_KEY_PATH=./config/credentials/ga4-service-account-key.json'));
  console.log(chalk.gray('\n# Or use the JSON directly (for production):'));
  console.log(chalk.gray('# GA4_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\''));
}

// Run the validator
if (require.main === module) {
  const validator = new GA4SetupValidator();
  
  validator.validate().catch(() => {
    generateEnvExample();
    process.exit(1);
  });
}

export { GA4SetupValidator };