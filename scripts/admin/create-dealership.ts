#!/usr/bin/env ts-node
/**
 * Dealership Creation and Setup CLI Tool
 * 
 * This script provides a comprehensive CLI tool for creating and setting up
 * new dealerships in the ADF system. It handles database record creation,
 * email configuration, user setup, default settings, and documentation generation.
 * 
 * Usage:
 *   ts-node scripts/admin/create-dealership.ts [options]
 * 
 * Options:
 *   --name             Dealership name
 *   --domain           Domain identifier (for subdomain)
 *   --email-domain     Email domain (optional, defaults to domain.com)
 *   --tier             Service tier (trial, standard, premium, enterprise)
 *   --email            Primary lead email address
 *   --imap-host        IMAP server hostname
 *   --imap-port        IMAP server port (default: 993)
 *   --imap-user        IMAP username
 *   --imap-pass        IMAP password
 *   --smtp-host        SMTP server hostname
 *   --smtp-port        SMTP server port (default: 587)
 *   --smtp-user        SMTP username
 *   --smtp-pass        SMTP password
 *   --admin-email      Admin user email
 *   --admin-name       Admin user name
 *   --generate-api-key Generate API key (true/false)
 *   --interactive      Run in interactive mode
 *   --output-dir       Directory for generated documentation
 *   --help             Show help
 * 
 * Example:
 *   ts-node scripts/admin/create-dealership.ts --name="ABC Honda" --domain="abc-honda" --email="leads@abchonda.com" --interactive
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { createHash, randomBytes } from 'crypto';
import { format } from 'date-fns';
import { validateEmail, validateDomain, validatePassword } from '../../server/utils/validation';
import { encryptPassword, encryptCredential } from '../../server/utils/encryption';
import logger from '../../server/utils/logger';

// Load environment variables
dotenv.config();

// Define types
interface DealershipDetails {
  name: string;
  legalName?: string;
  domain: string;
  emailDomain?: string;
  tier: 'trial' | 'standard' | 'premium' | 'enterprise';
  primaryColor?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  phone?: string;
  website?: string;
  timezone?: string;
}

interface EmailConfig {
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapUseSsl: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpUseSsl?: boolean;
  isPrimary: boolean;
}

interface AdminUser {
  email: string;
  name: string;
  role: 'owner' | 'admin';
  phone?: string;
  title?: string;
  department?: string;
}

interface ApiKeyConfig {
  name: string;
  scopes: string[];
}

interface SetupResult {
  dealershipId: number;
  dealership: DealershipDetails;
  emailConfigId: number;
  emailConfig: EmailConfig;
  adminUserId: number;
  adminUser: AdminUser;
  apiKey?: {
    id: number;
    key: string;
    prefix: string;
  };
  setupTimestamp: string;
  dashboardUrl: string;
  adminLoginUrl: string;
}

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize command line parser
const program = new Command();

program
  .name('create-dealership')
  .description('Create and set up a new dealership in the ADF system')
  .option('--name <name>', 'Dealership name')
  .option('--domain <domain>', 'Domain identifier (for subdomain)')
  .option('--email-domain <emailDomain>', 'Email domain (optional, defaults to domain.com)')
  .option('--tier <tier>', 'Service tier (trial, standard, premium, enterprise)', 'standard')
  .option('--email <email>', 'Primary lead email address')
  .option('--imap-host <imapHost>', 'IMAP server hostname')
  .option('--imap-port <imapPort>', 'IMAP server port', '993')
  .option('--imap-user <imapUser>', 'IMAP username')
  .option('--imap-pass <imapPass>', 'IMAP password')
  .option('--smtp-host <smtpHost>', 'SMTP server hostname')
  .option('--smtp-port <smtpPort>', 'SMTP server port', '587')
  .option('--smtp-user <smtpUser>', 'SMTP username')
  .option('--smtp-pass <smtpPass>', 'SMTP password')
  .option('--admin-email <adminEmail>', 'Admin user email')
  .option('--admin-name <adminName>', 'Admin user name')
  .option('--generate-api-key', 'Generate API key', false)
  .option('--interactive', 'Run in interactive mode', false)
  .option('--output-dir <outputDir>', 'Directory for generated documentation', './dealership-docs')
  .helpOption('--help', 'Show help')
  .parse(process.argv);

// Main function
async function main() {
  try {
    console.log(chalk.blue('================================================='));
    console.log(chalk.blue('🏢  ADF DEALERSHIP CREATION AND SETUP TOOL'));
    console.log(chalk.blue('================================================='));
    console.log();

    const options = program.opts();
    
    // Check if interactive mode or sufficient parameters provided
    if (!options.interactive && (!options.name || !options.domain || !options.email || !options.imapHost || !options.imapUser || !options.imapPass)) {
      console.log(chalk.yellow('⚠️  Insufficient parameters provided.'));
      console.log(chalk.yellow('   Please provide all required parameters or use --interactive mode.'));
      console.log();
      program.help();
      return;
    }

    // Get dealership details
    const dealershipDetails = await getDealershipDetails(options);
    
    // Get email configuration
    const emailConfig = await getEmailConfig(options);
    
    // Get admin user details
    const adminUser = await getAdminUser(options);
    
    // Confirm setup
    if (options.interactive) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Ready to create dealership. Continue?',
          default: true,
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('Setup cancelled by user.'));
        return;
      }
    }
    
    // Create dealership in database
    const setupResult = await setupDealership(dealershipDetails, emailConfig, adminUser, options.generateApiKey);
    
    // Generate documentation
    await generateDocumentation(setupResult, options.outputDir);
    
    // Display setup summary
    displaySetupSummary(setupResult);
    
    console.log(chalk.green('\n✅ Dealership setup completed successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. Share the setup documentation with the customer (${options.outputDir}/setup-guide.md)`);
    console.log(`  2. Verify email processing is working: npm run test:email -- --dealership=${setupResult.dealershipId}`);
    console.log(`  3. Send the admin login URL to the dealership admin: ${setupResult.adminLoginUrl}`);
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    logger.error('Dealership creation failed', { error });
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

/**
 * Get dealership details from command line options or interactive prompts
 */
async function getDealershipDetails(options: any): Promise<DealershipDetails> {
  if (options.interactive) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Dealership name:',
        default: options.name,
        validate: (input) => input.length >= 3 ? true : 'Name must be at least 3 characters',
      },
      {
        type: 'input',
        name: 'legalName',
        message: 'Legal business name (optional):',
        default: options.legalName,
      },
      {
        type: 'input',
        name: 'domain',
        message: 'Domain identifier (for subdomain):',
        default: options.domain || (options.name ? options.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : ''),
        validate: (input) => validateDomain(input) ? true : 'Domain must contain only lowercase letters, numbers, and hyphens',
      },
      {
        type: 'input',
        name: 'emailDomain',
        message: 'Email domain (optional, defaults to domain.com):',
        default: options.emailDomain || (options.domain ? `${options.domain}.com` : ''),
      },
      {
        type: 'list',
        name: 'tier',
        message: 'Service tier:',
        choices: ['trial', 'standard', 'premium', 'enterprise'],
        default: options.tier || 'standard',
      },
      {
        type: 'input',
        name: 'primaryColor',
        message: 'Primary brand color (hex code, optional):',
        default: options.primaryColor || '#336699',
        validate: (input) => /^#[0-9A-Fa-f]{6}$/.test(input) ? true : 'Please enter a valid hex color code (e.g., #336699)',
      },
      {
        type: 'input',
        name: 'phone',
        message: 'Dealership phone number (optional):',
        default: options.phone,
      },
      {
        type: 'input',
        name: 'website',
        message: 'Dealership website (optional):',
        default: options.website || (options.domain ? `https://www.${options.domain}.com` : ''),
      },
      {
        type: 'input',
        name: 'timezone',
        message: 'Timezone (optional):',
        default: options.timezone || 'America/New_York',
      },
    ]);
    
    return {
      name: answers.name,
      legalName: answers.legalName,
      domain: answers.domain,
      emailDomain: answers.emailDomain,
      tier: answers.tier as 'trial' | 'standard' | 'premium' | 'enterprise',
      primaryColor: answers.primaryColor,
      phone: answers.phone,
      website: answers.website,
      timezone: answers.timezone,
    };
  } else {
    // Use command line options
    return {
      name: options.name,
      domain: options.domain,
      emailDomain: options.emailDomain || `${options.domain}.com`,
      tier: (options.tier || 'standard') as 'trial' | 'standard' | 'premium' | 'enterprise',
    };
  }
}

/**
 * Get email configuration from command line options or interactive prompts
 */
async function getEmailConfig(options: any): Promise<EmailConfig> {
  if (options.interactive) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'emailAddress',
        message: 'Lead email address:',
        default: options.email,
        validate: (input) => validateEmail(input) ? true : 'Please enter a valid email address',
      },
      {
        type: 'input',
        name: 'displayName',
        message: 'Email display name (optional):',
        default: options.displayName || options.name,
      },
      {
        type: 'input',
        name: 'imapHost',
        message: 'IMAP server hostname:',
        default: options.imapHost || 'imap.gmail.com',
        validate: (input) => input.length > 0 ? true : 'IMAP hostname is required',
      },
      {
        type: 'input',
        name: 'imapPort',
        message: 'IMAP server port:',
        default: options.imapPort || '993',
        validate: (input) => !isNaN(parseInt(input)) ? true : 'Port must be a number',
      },
      {
        type: 'input',
        name: 'imapUser',
        message: 'IMAP username:',
        default: options.imapUser || options.email,
        validate: (input) => input.length > 0 ? true : 'IMAP username is required',
      },
      {
        type: 'password',
        name: 'imapPass',
        message: 'IMAP password:',
        mask: '*',
        validate: (input) => input.length > 0 ? true : 'IMAP password is required',
      },
      {
        type: 'confirm',
        name: 'imapUseSsl',
        message: 'Use SSL for IMAP?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'configureSMTP',
        message: 'Configure SMTP for sending emails?',
        default: true,
      },
      {
        type: 'input',
        name: 'smtpHost',
        message: 'SMTP server hostname:',
        default: options.smtpHost || 'smtp.gmail.com',
        when: (answers) => answers.configureSMTP,
      },
      {
        type: 'input',
        name: 'smtpPort',
        message: 'SMTP server port:',
        default: options.smtpPort || '587',
        validate: (input) => !isNaN(parseInt(input)) ? true : 'Port must be a number',
        when: (answers) => answers.configureSMTP,
      },
      {
        type: 'input',
        name: 'smtpUser',
        message: 'SMTP username:',
        default: options.smtpUser || options.email,
        when: (answers) => answers.configureSMTP,
      },
      {
        type: 'password',
        name: 'smtpPass',
        message: 'SMTP password:',
        mask: '*',
        when: (answers) => answers.configureSMTP,
      },
      {
        type: 'confirm',
        name: 'smtpUseSsl',
        message: 'Use SSL for SMTP?',
        default: true,
        when: (answers) => answers.configureSMTP,
      },
    ]);
    
    return {
      emailAddress: answers.emailAddress,
      displayName: answers.displayName,
      imapHost: answers.imapHost,
      imapPort: parseInt(answers.imapPort),
      imapUser: answers.imapUser,
      imapPass: answers.imapPass,
      imapUseSsl: answers.imapUseSsl,
      smtpHost: answers.configureSMTP ? answers.smtpHost : undefined,
      smtpPort: answers.configureSMTP ? parseInt(answers.smtpPort) : undefined,
      smtpUser: answers.configureSMTP ? answers.smtpUser : undefined,
      smtpPass: answers.configureSMTP ? answers.smtpPass : undefined,
      smtpUseSsl: answers.configureSMTP ? answers.smtpUseSsl : undefined,
      isPrimary: true,
    };
  } else {
    // Use command line options
    return {
      emailAddress: options.email,
      imapHost: options.imapHost,
      imapPort: parseInt(options.imapPort || '993'),
      imapUser: options.imapUser,
      imapPass: options.imapPass,
      imapUseSsl: true,
      smtpHost: options.smtpHost,
      smtpPort: options.smtpPort ? parseInt(options.smtpPort) : undefined,
      smtpUser: options.smtpUser,
      smtpPass: options.smtpPass,
      isPrimary: true,
    };
  }
}

/**
 * Get admin user details from command line options or interactive prompts
 */
async function getAdminUser(options: any): Promise<AdminUser> {
  if (options.interactive) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Admin user email:',
        default: options.adminEmail,
        validate: (input) => validateEmail(input) ? true : 'Please enter a valid email address',
      },
      {
        type: 'input',
        name: 'name',
        message: 'Admin user name:',
        default: options.adminName,
        validate: (input) => input.length >= 3 ? true : 'Name must be at least 3 characters',
      },
      {
        type: 'list',
        name: 'role',
        message: 'Admin user role:',
        choices: ['owner', 'admin'],
        default: 'owner',
      },
      {
        type: 'input',
        name: 'phone',
        message: 'Admin phone number (optional):',
      },
      {
        type: 'input',
        name: 'title',
        message: 'Admin job title (optional):',
        default: 'Dealership Owner',
      },
      {
        type: 'input',
        name: 'department',
        message: 'Admin department (optional):',
        default: 'Management',
      },
    ]);
    
    return {
      email: answers.email,
      name: answers.name,
      role: answers.role as 'owner' | 'admin',
      phone: answers.phone,
      title: answers.title,
      department: answers.department,
    };
  } else {
    // Use command line options
    return {
      email: options.adminEmail || options.email,
      name: options.adminName || 'Dealership Admin',
      role: 'owner',
    };
  }
}

/**
 * Set up dealership in database
 */
async function setupDealership(
  dealership: DealershipDetails,
  emailConfig: EmailConfig,
  adminUser: AdminUser,
  generateApiKey: boolean
): Promise<SetupResult> {
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create dealership spinner
    const spinner = ora('Setting up dealership...').start();
    
    // 1. Create dealership record
    spinner.text = 'Creating dealership record...';
    const dealershipResult = await client.query(
      `SELECT * FROM create_dealership($1, $2, $3, $4, $5)`,
      [dealership.name, dealership.domain, dealership.emailDomain, dealership.tier, 'system']
    );
    const dealershipId = dealershipResult.rows[0].create_dealership;
    
    // 2. Update additional dealership details
    if (dealership.legalName || dealership.primaryColor || dealership.phone || dealership.website || dealership.timezone) {
      await client.query(
        `UPDATE dealerships SET 
          legal_name = COALESCE($1, legal_name),
          primary_color = COALESCE($2, primary_color),
          phone = COALESCE($3, phone),
          website = COALESCE($4, website),
          timezone = COALESCE($5, timezone),
          updated_at = NOW()
        WHERE id = $6`,
        [
          dealership.legalName,
          dealership.primaryColor,
          dealership.phone,
          dealership.website,
          dealership.timezone,
          dealershipId
        ]
      );
    }
    
    // 3. Add email configuration
    spinner.text = 'Setting up email configuration...';
    const emailConfigResult = await client.query(
      `SELECT * FROM add_dealership_email_config($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        dealershipId,
        emailConfig.emailAddress,
        emailConfig.imapHost,
        emailConfig.imapPort,
        emailConfig.imapUser,
        emailConfig.imapPass,
        emailConfig.isPrimary,
        emailConfig.smtpHost,
        emailConfig.smtpPort,
        emailConfig.smtpUser,
        emailConfig.smtpPass
      ]
    );
    const emailConfigId = emailConfigResult.rows[0].add_dealership_email_config;
    
    // 4. Add display name if provided
    if (emailConfig.displayName) {
      await client.query(
        `UPDATE dealership_email_configs SET display_name = $1 WHERE id = $2`,
        [emailConfig.displayName, emailConfigId]
      );
    }
    
    // 5. Create admin user
    spinner.text = 'Creating admin user...';
    const adminUserResult = await client.query(
      `SELECT * FROM add_dealership_user($1, $2, $3, $4, $5)`,
      [dealershipId, adminUser.email, adminUser.name, adminUser.role, 'system']
    );
    const adminUserId = adminUserResult.rows[0].add_dealership_user;
    
    // 6. Update additional admin user details
    if (adminUser.phone || adminUser.title || adminUser.department) {
      await client.query(
        `UPDATE dealership_users SET 
          phone = COALESCE($1, phone),
          title = COALESCE($2, title),
          department = COALESCE($3, department),
          updated_at = NOW()
        WHERE id = $4`,
        [adminUser.phone, adminUser.title, adminUser.department, adminUserId]
      );
    }
    
    // 7. Set up default settings
    spinner.text = 'Configuring default settings...';
    
    // Email settings
    await client.query(
      `SELECT * FROM update_dealership_setting($1, $2, $3, $4, $5)`,
      [
        dealershipId,
        'email',
        'reply_template',
        JSON.stringify({
          subject: `Thank you for your interest in ${dealership.name}`,
          body: `Dear {{customer.name}},\n\nThank you for your interest in the {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. One of our sales representatives will contact you shortly.\n\nBest regards,\n${dealership.name} Team`
        }),
        'system'
      ]
    );
    
    // SMS settings
    await client.query(
      `SELECT * FROM update_dealership_setting($1, $2, $3, $4, $5)`,
      [
        dealershipId,
        'sms',
        'template',
        JSON.stringify({
          body: `Hi {{customer.name}}, thanks for your interest in ${dealership.name}! We received your inquiry about the {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. A team member will call you soon. Reply STOP to opt-out.`
        }),
        'system'
      ]
    );
    
    // AI settings
    await client.query(
      `SELECT * FROM update_dealership_setting($1, $2, $3, $4, $5)`,
      [
        dealershipId,
        'ai',
        'model',
        JSON.stringify({
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7
        }),
        'system'
      ]
    );
    
    // Intent settings
    await client.query(
      `SELECT * FROM update_dealership_setting($1, $2, $3, $4, $5)`,
      [
        dealershipId,
        'intent',
        'handover_threshold',
        JSON.stringify(0.85),
        'system'
      ]
    );
    
    // 8. Generate API key if requested
    let apiKey = undefined;
    if (generateApiKey) {
      spinner.text = 'Generating API key...';
      
      // Generate API key
      const rawApiKey = `adf_${randomBytes(32).toString('hex')}`;
      const apiKeyPrefix = rawApiKey.substring(0, 10);
      const apiKeyHash = createHash('sha256').update(rawApiKey).digest('hex');
      
      // Insert API key
      const apiKeyResult = await client.query(
        `INSERT INTO dealership_api_keys (
          dealership_id, name, api_key_prefix, api_key_hash, scopes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          dealershipId,
          'Default API Key',
          apiKeyPrefix,
          apiKeyHash,
          ['leads:read', 'leads:write', 'analytics:read'],
          'system'
        ]
      );
      
      apiKey = {
        id: apiKeyResult.rows[0].id,
        key: rawApiKey,
        prefix: apiKeyPrefix,
      };
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    spinner.succeed('Dealership setup completed successfully!');
    
    // Return setup result
    const setupTimestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const dashboardUrl = `https://dashboard.yoursaas.com/${dealership.domain}`;
    const adminLoginUrl = `https://dashboard.yoursaas.com/${dealership.domain}/login`;
    
    return {
      dealershipId,
      dealership,
      emailConfigId,
      emailConfig,
      adminUserId,
      adminUser,
      apiKey,
      setupTimestamp,
      dashboardUrl,
      adminLoginUrl,
    };
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Release client
    client.release();
  }
}

/**
 * Generate documentation for the dealership
 */
async function generateDocumentation(setupResult: SetupResult, outputDir: string): Promise<void> {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create dealership-specific directory
  const dealershipDir = path.join(outputDir, setupResult.dealership.domain);
  if (!fs.existsSync(dealershipDir)) {
    fs.mkdirSync(dealershipDir, { recursive: true });
  }
  
  // Generate setup guide
  const setupGuidePath = path.join(dealershipDir, 'setup-guide.md');
  const setupGuideContent = `# ${setupResult.dealership.name} - ADF System Setup Guide

## Overview

This document provides setup information and credentials for your ADF Lead Processing system.

**Setup Date:** ${setupResult.setupTimestamp}

## Access Information

### Dashboard Access

- **URL:** ${setupResult.dashboardUrl}
- **Admin Login:** ${setupResult.adminLoginUrl}
- **Username:** ${setupResult.adminUser.email}
- **Initial Login:** Use the "Forgot Password" link to set your password

### Email Configuration

Your system is configured to process leads sent to:

- **Email Address:** ${setupResult.emailConfig.emailAddress}

### API Access

${setupResult.apiKey ? `
Your system includes API access for integration with other systems:

- **API Key:** \`${setupResult.apiKey.key}\`
- **Base URL:** \`https://api.yoursaas.com/v1/${setupResult.dealership.domain}\`
- **Documentation:** ${setupResult.dashboardUrl}/api-docs
` : 'API access is not currently enabled for your account.'}

## Sending Leads to Your System

### Email-Based Delivery (Recommended)

To send ADF leads to your system:

1. Configure your lead providers to send ADF XML leads to: ${setupResult.emailConfig.emailAddress}
2. Ensure leads are sent as XML attachments
3. No special subject line or format is required

### Testing Your Setup

To verify your setup is working correctly:

1. Send a test email with an ADF XML attachment to ${setupResult.emailConfig.emailAddress}
2. Check the dashboard for the incoming lead (typically within 2-5 minutes)
3. Verify that an automated response is sent to the customer

## Support Information

If you need assistance with your ADF system:

- **Technical Support:** support@yoursaas.com
- **Phone Support:** 1-800-555-1234
- **Hours:** Monday-Friday, 9am-6pm Eastern Time

## Next Steps

1. Log in to your dashboard at ${setupResult.adminLoginUrl}
2. Complete your dealership profile
3. Customize response templates
4. Configure your team members
5. Set up integrations with your CRM or other systems

Thank you for choosing our ADF Lead Processing system!
`;

  fs.writeFileSync(setupGuidePath, setupGuideContent);
  
  // Generate technical documentation
  const techDocPath = path.join(dealershipDir, 'technical-details.md');
  const techDocContent = `# ${setupResult.dealership.name} - Technical Configuration

## Database Configuration

- **Dealership ID:** ${setupResult.dealershipId}
- **Domain:** ${setupResult.dealership.domain}
- **Tier:** ${setupResult.dealership.tier}

## Email Configuration

- **Email Config ID:** ${setupResult.emailConfigId}
- **Email Address:** ${setupResult.emailConfig.emailAddress}
- **IMAP Host:** ${setupResult.emailConfig.imapHost}
- **IMAP Port:** ${setupResult.emailConfig.imapPort}
- **IMAP User:** ${setupResult.emailConfig.imapUser}
- **SMTP Host:** ${setupResult.emailConfig.smtpHost || 'Not configured'}
- **SMTP Port:** ${setupResult.emailConfig.smtpPort || 'Not configured'}

## Admin User

- **Admin User ID:** ${setupResult.adminUserId}
- **Email:** ${setupResult.adminUser.email}
- **Name:** ${setupResult.adminUser.name}
- **Role:** ${setupResult.adminUser.role}

## API Configuration

${setupResult.apiKey ? `
- **API Key ID:** ${setupResult.apiKey.id}
- **API Key Prefix:** ${setupResult.apiKey.prefix}
- **Full API Key:** \`${setupResult.apiKey.key}\`
` : '- No API key configured'}

## Testing Commands

\`\`\`bash
# Test email processing
npm run test:email -- --dealership=${setupResult.dealershipId}

# Check email health
curl http://localhost:3000/api/health/email?dealership=${setupResult.dealershipId}

# Monitor processing
npm run dev:queue
\`\`\`

## Default Settings

### Email Template
\`\`\`json
{
  "subject": "Thank you for your interest in ${setupResult.dealership.name}",
  "body": "Dear {{customer.name}},\\n\\nThank you for your interest in the {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. One of our sales representatives will contact you shortly.\\n\\nBest regards,\\n${setupResult.dealership.name} Team"
}
\`\`\`

### SMS Template
\`\`\`json
{
  "body": "Hi {{customer.name}}, thanks for your interest in ${setupResult.dealership.name}! We received your inquiry about the {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. A team member will call you soon. Reply STOP to opt-out."
}
\`\`\`

### AI Configuration
\`\`\`json
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7
}
\`\`\`

### Intent Detection
\`\`\`json
{
  "handover_threshold": 0.85
}
\`\`\`

## Setup Timestamp

${setupResult.setupTimestamp}
`;

  fs.writeFileSync(techDocPath, techDocContent);
  
  // Generate sample ADF XML
  const sampleAdfPath = path.join(dealershipDir, 'sample-adf.xml');
  const sampleAdfContent = `<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect>
    <requestdate>${format(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ss')}</requestdate>
    <vehicle interest="buy" status="new">
      <year>2024</year>
      <make>Honda</make>
      <model>Accord</model>
      <trim>Touring</trim>
      <color>Blue</color>
    </vehicle>
    <customer>
      <contact>
        <name part="full">John Smith</name>
        <email>john.smith@example.com</email>
        <phone type="voice" time="day">555-123-4567</phone>
      </contact>
      <comments>I'm interested in the 2024 Honda Accord Touring in blue. Do you have any in stock? What's your best price?</comments>
    </customer>
    <vendor>
      <vendorname>AutoTrader</vendorname>
      <contact>
        <name part="full">Auto Trader</name>
        <email>leads@autotrader.com</email>
      </contact>
    </vendor>
    <provider>
      <name part="full">ADF Lead Provider</name>
      <service>Lead Generation</service>
      <url>http://www.leadprovider.com</url>
    </provider>
  </prospect>
</adf>`;

  fs.writeFileSync(sampleAdfPath, sampleAdfContent);
  
  console.log(chalk.green(`\n📝 Documentation generated in ${dealershipDir}`));
}

/**
 * Display setup summary
 */
function displaySetupSummary(setupResult: SetupResult): void {
  console.log(chalk.blue('\n================================================='));
  console.log(chalk.blue(`🏢  DEALERSHIP SETUP SUMMARY: ${setupResult.dealership.name}`));
  console.log(chalk.blue('================================================='));
  console.log();
  
  console.log(chalk.yellow('Dealership Details:'));
  console.log(`  ID: ${setupResult.dealershipId}`);
  console.log(`  Name: ${setupResult.dealership.name}`);
  console.log(`  Domain: ${setupResult.dealership.domain}`);
  console.log(`  Tier: ${setupResult.dealership.tier}`);
  
  console.log(chalk.yellow('\nEmail Configuration:'));
  console.log(`  Email: ${setupResult.emailConfig.emailAddress}`);
  console.log(`  IMAP: ${setupResult.emailConfig.imapHost}:${setupResult.emailConfig.imapPort}`);
  console.log(`  SMTP: ${setupResult.emailConfig.smtpHost || 'Not configured'}`);
  
  console.log(chalk.yellow('\nAdmin User:'));
  console.log(`  Email: ${setupResult.adminUser.email}`);
  console.log(`  Name: ${setupResult.adminUser.name}`);
  console.log(`  Role: ${setupResult.adminUser.role}`);
  
  if (setupResult.apiKey) {
    console.log(chalk.yellow('\nAPI Key:'));
    console.log(`  Key: ${setupResult.apiKey.key}`);
    console.log(`  Prefix: ${setupResult.apiKey.prefix}`);
  }
  
  console.log(chalk.yellow('\nAccess URLs:'));
  console.log(`  Dashboard: ${setupResult.dashboardUrl}`);
  console.log(`  Admin Login: ${setupResult.adminLoginUrl}`);
  
  console.log(chalk.yellow('\nDocumentation:'));
  console.log(`  Setup Guide: ./dealership-docs/${setupResult.dealership.domain}/setup-guide.md`);
  console.log(`  Technical Details: ./dealership-docs/${setupResult.dealership.domain}/technical-details.md`);
  console.log(`  Sample ADF: ./dealership-docs/${setupResult.dealership.domain}/sample-adf.xml`);
}

// Run the script
main().catch(error => {
  console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
  logger.error('Dealership creation failed', { error });
  process.exit(1);
});
