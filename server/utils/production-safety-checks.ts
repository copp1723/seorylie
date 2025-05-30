/**
 * production-safety-checks.ts
 * 
 * Comprehensive production safety validation module that checks for common
 * misconfigurations that could cause security vulnerabilities in production.
 * 
 * This module should be called during server startup to ensure the application
 * is configured securely before accepting any connections.
 */

import logger from './logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

// Critical environment variables that must be set in production
const CRITICAL_ENV_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'JWT_SECRET',
  'OPENAI_API_KEY'
];

// Environment variables that should never be set to insecure values in production
const INSECURE_ENV_SETTINGS = [
  { name: 'ALLOW_AUTH_BYPASS', insecureValue: 'true' },
  { name: 'SKIP_RLS', insecureValue: 'true' },
  { name: 'DISABLE_CSRF', insecureValue: 'true' },
  { name: 'DISABLE_RATE_LIMIT', insecureValue: 'true' }
];

// Minimum required length for security-sensitive environment variables
const MIN_SECRET_LENGTH = 32;

/**
 * Main validation function that runs all safety checks
 */
export async function validateProductionSafety(): Promise<void> {
  logger.info('Running production safety checks...');
  
  // Only perform strict validation in production/staging
  if (isProduction || isStaging) {
    validateCriticalEnvVars();
    validateSecretStrength();
    validateSecureSettings();
    await validateDatabaseConnection();
    await validateRowLevelSecurity();
  } else {
    // In development/test, just warn about insecure settings
    warnAboutInsecureSettings();
  }
  
  logger.info('Production safety checks completed successfully');
}

/**
 * Validates that all critical environment variables are set
 */
function validateCriticalEnvVars(): void {
  logger.debug('Validating critical environment variables...');
  
  const missingVars = CRITICAL_ENV_VARS.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    const errorMsg = `
      ⚠️ CRITICAL CONFIGURATION ERROR ⚠️
      The following required environment variables are missing:
      ${missingVars.join(', ')}
      
      These variables are required for secure operation in ${process.env.NODE_ENV} environment.
      Please set these variables and restart the application.
    `;
    
    logFatalError(errorMsg, 'MISSING_CRITICAL_ENV_VARS');
  }
}

/**
 * Validates that security-sensitive environment variables have sufficient entropy
 */
function validateSecretStrength(): void {
  logger.debug('Validating security token strength...');
  
  const weakSecrets: string[] = [];
  
  // Check SESSION_SECRET
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < MIN_SECRET_LENGTH) {
    weakSecrets.push('SESSION_SECRET');
  }
  
  // Check JWT_SECRET
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
    weakSecrets.push('JWT_SECRET');
  }
  
  if (weakSecrets.length > 0) {
    const errorMsg = `
      ⚠️ CRITICAL SECURITY VULNERABILITY ⚠️
      The following security tokens are too weak (less than ${MIN_SECRET_LENGTH} characters):
      ${weakSecrets.join(', ')}
      
      Weak secrets can be easily brute-forced, compromising the entire application.
      Please generate stronger secrets and restart the application.
    `;
    
    logFatalError(errorMsg, 'WEAK_SECURITY_SECRETS');
  }
}

/**
 * Validates that no insecure settings are enabled in production
 */
function validateSecureSettings(): void {
  logger.debug('Validating secure environment settings...');
  
  const insecureSettings = INSECURE_ENV_SETTINGS.filter(
    setting => process.env[setting.name] === setting.insecureValue
  );
  
  if (insecureSettings.length > 0) {
    const errorMsg = `
      ⚠️ CRITICAL SECURITY VULNERABILITY ⚠️
      The following insecure settings are enabled in ${process.env.NODE_ENV} environment:
      ${insecureSettings.map(s => `${s.name}=${s.insecureValue}`).join(', ')}
      
      These settings bypass critical security controls and should NEVER be enabled in production.
      Please correct these settings and restart the application.
    `;
    
    logFatalError(errorMsg, 'INSECURE_SETTINGS_ENABLED');
  }
}

/**
 * Validates database connection and configuration
 */
async function validateDatabaseConnection(): Promise<void> {
  logger.debug('Validating database connection...');
  
  try {
    // Test database connection
    const result = await db.execute(sql`SELECT NOW()`);
    if (!result) {
      throw new Error('Database query returned no result');
    }
    
    // Check SSL configuration for production
    const connectionString = process.env.DATABASE_URL || '';
    if (isProduction && !connectionString.includes('ssl=true')) {
      logger.warn('Database connection may not be using SSL encryption', {
        action: 'Update DATABASE_URL to include ssl=true for secure connections'
      });
    }
    
    logger.debug('Database connection validated successfully');
  } catch (error) {
    const errorMsg = `
      ⚠️ CRITICAL DATABASE CONNECTION ERROR ⚠️
      Unable to connect to the database: ${error instanceof Error ? error.message : String(error)}
      
      A working database connection is required for the application to function.
      Please check your database configuration and ensure the database is accessible.
    `;
    
    logFatalError(errorMsg, 'DATABASE_CONNECTION_FAILED');
  }
}

/**
 * Validates that Row Level Security (RLS) is properly enabled
 */
async function validateRowLevelSecurity(): Promise<void> {
  logger.debug('Validating Row Level Security (RLS) configuration...');
  
  try {
    // Check if RLS functions exist
    const rlsFunctionResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM pg_proc 
      WHERE proname = 'set_tenant_context'
    `);
    
    const rlsFunctionCount = parseInt(String(rlsFunctionResult?.[0]?.count || '0'), 10);
    
    if (rlsFunctionCount === 0) {
      const errorMsg = `
        ⚠️ SECURITY CONFIGURATION ERROR ⚠️
        Row Level Security (RLS) functions are not installed in the database.
        
        This means tenant isolation is not enforced at the database level, creating a risk
        of cross-tenant data leakage. Please run the RLS migration (0011_enable_row_level_security.sql)
        before continuing.
      `;
      
      logFatalError(errorMsg, 'RLS_NOT_CONFIGURED');
    }
    
    // Check if RLS is enabled on critical tables
    const criticalTables = ['conversations', 'leads', 'customers', 'vehicles', 'users'];
    
    for (const table of criticalTables) {
      const rlsResult = await db.execute(sql`
        SELECT relrowsecurity FROM pg_class 
        WHERE relname = ${table} AND relkind = 'r'
      `);
      
      const rlsEnabled = rlsResult?.[0]?.relrowsecurity === true;
      
      if (!rlsEnabled) {
        const errorMsg = `
          ⚠️ SECURITY CONFIGURATION ERROR ⚠️
          Row Level Security (RLS) is not enabled on the '${table}' table.
          
          This critical table requires RLS to enforce tenant isolation at the database level.
          Please run the RLS migration (0011_enable_row_level_security.sql) before continuing.
        `;
        
        logFatalError(errorMsg, 'RLS_NOT_ENABLED');
      }
    }
    
    logger.debug('Row Level Security validation completed successfully');
  } catch (error) {
    logger.error('Error validating Row Level Security', error);
    // Don't fail startup on RLS check errors, but log them prominently
    console.error('\x1b[41m\x1b[37m%s\x1b[0m', 'WARNING: Unable to validate Row Level Security configuration');
  }
}

/**
 * Warns about insecure settings in development/test environments
 */
function warnAboutInsecureSettings(): void {
  logger.debug('Checking for insecure development settings...');
  
  const insecureSettings = INSECURE_ENV_SETTINGS.filter(
    setting => process.env[setting.name] === setting.insecureValue
  );
  
  if (insecureSettings.length > 0) {
    const warningMsg = `
      ⚠️ DEVELOPMENT SECURITY WARNING ⚠️
      The following insecure settings are enabled in ${process.env.NODE_ENV} environment:
      ${insecureSettings.map(s => `${s.name}=${s.insecureValue}`).join(', ')}
      
      While acceptable for development/testing, these settings would create severe
      security vulnerabilities if enabled in production.
    `;
    
    logger.warn(warningMsg);
    console.warn('\x1b[43m\x1b[30m%s\x1b[0m', warningMsg);
  }
}

/**
 * Logs a fatal error and exits the process
 */
function logFatalError(message: string, code: string): never {
  logger.error(`FATAL ERROR [${code}]: Production safety check failed`, new Error(message));
  
  // Print to console for visibility
  console.error('\x1b[41m\x1b[37m%s\x1b[0m', message);
  
  // Exit the process with error code
  process.exit(1);
}

/**
 * Checks if a specific environment variable is set to an insecure value
 * Utility function that can be called from other parts of the application
 */
export function isInsecureSettingEnabled(settingName: string): boolean {
  const setting = INSECURE_ENV_SETTINGS.find(s => s.name === settingName);
  
  if (!setting) {
    return false;
  }
  
  return process.env[setting.name] === setting.insecureValue;
}

/**
 * Validates a specific aspect of the application configuration
 * Utility function that can be called for partial validation
 */
export async function validateConfigurationAspect(aspect: 'env' | 'database' | 'rls' | 'auth'): Promise<boolean> {
  try {
    switch (aspect) {
      case 'env':
        validateCriticalEnvVars();
        validateSecretStrength();
        break;
      case 'database':
        await validateDatabaseConnection();
        break;
      case 'rls':
        await validateRowLevelSecurity();
        break;
      case 'auth':
        validateSecureSettings();
        break;
      default:
        logger.warn(`Unknown configuration aspect: ${aspect}`);
        return false;
    }
    return true;
  } catch (error) {
    logger.error(`Error validating ${aspect} configuration`, error);
    return false;
  }
}
