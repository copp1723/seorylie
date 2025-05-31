#!/usr/bin/env tsx

/**
 * Environment Validation Script
 * 
 * Validates environment configuration for different deployment environments
 * Used by CI/CD pipeline and deployment processes
 */

interface EnvValidationRule {
  name: string;
  required: boolean;
  pattern?: RegExp;
  description: string;
  example?: string;
}

interface ValidationResult {
  variable: string;
  status: 'valid' | 'invalid' | 'missing' | 'warning';
  message: string;
  value?: string;
}

class EnvironmentValidator {
  private results: ValidationResult[] = [];

  private readonly rules: EnvValidationRule[] = [
    // Database
    {
      name: 'DATABASE_URL',
      required: true,
      pattern: /^postgres(ql)?:\/\/.+/,
      description: 'PostgreSQL connection string',
      example: 'postgres://user:pass@host:5432/dbname'
    },
    
    // Redis (optional but recommended)
    {
      name: 'REDIS_URL',
      required: false,
      pattern: /^redis:\/\/.+/,
      description: 'Redis connection string',
      example: 'redis://localhost:6379'
    },
    
    // Security
    {
      name: 'JWT_SECRET',
      required: true,
      pattern: /^.{32,}$/,
      description: 'JWT signing secret (minimum 32 characters)',
      example: 'your-super-secret-jwt-key-here-min-32-chars'
    },
    
    // API Keys
    {
      name: 'OPENAI_API_KEY',
      required: false,
      pattern: /^sk-.+/,
      description: 'OpenAI API key for AI features',
      example: 'sk-...'
    },
    
    // Email Configuration
    {
      name: 'SENDGRID_API_KEY',
      required: false,
      pattern: /^SG\..+/,
      description: 'SendGrid API key for email services',
      example: 'SG.xxx'
    },
    
    {
      name: 'GMAIL_USER',
      required: false,
      pattern: /^.+@.+\..+$/,
      description: 'Gmail address for email services',
      example: 'your-email@gmail.com'
    },
    
    {
      name: 'GMAIL_PASS',
      required: false,
      description: 'Gmail app password for email services'
    },
    
    // Application Configuration
    {
      name: 'NODE_ENV',
      required: false,
      pattern: /^(development|production|test)$/,
      description: 'Node.js environment',
      example: 'production'
    },
    
    {
      name: 'PORT',
      required: false,
      pattern: /^\d{4,5}$/,
      description: 'Application port number',
      example: '3000'
    },
    
    {
      name: 'CORS_ORIGIN',
      required: false,
      description: 'CORS allowed origins',
      example: 'https://yourdomain.com'
    },
    
    // Session Configuration
    {
      name: 'SESSION_SECRET',
      required: false,
      pattern: /^.{32,}$/,
      description: 'Session secret (minimum 32 characters)',
      example: 'your-session-secret-here-min-32-chars'
    },
    
    // External Services
    {
      name: 'TWILIO_ACCOUNT_SID',
      required: false,
      pattern: /^AC[a-f0-9]{32}$/,
      description: 'Twilio Account SID for SMS services',
      example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    },
    
    {
      name: 'TWILIO_AUTH_TOKEN',
      required: false,
      description: 'Twilio Auth Token for SMS services'
    },
    
    {
      name: 'TWILIO_PHONE_NUMBER',
      required: false,
      pattern: /^\+\d{10,15}$/,
      description: 'Twilio phone number',
      example: '+1234567890'
    }
  ];

  private addResult(variable: string, status: ValidationResult['status'], message: string, value?: string) {
    this.results.push({
      variable,
      status,
      message,
      value: value && status !== 'missing' ? this.maskSensitiveValue(variable, value) : undefined
    });
  }

  private maskSensitiveValue(variable: string, value: string): string {
    const sensitivePatterns = ['SECRET', 'KEY', 'TOKEN', 'PASS'];
    
    if (sensitivePatterns.some(pattern => variable.includes(pattern))) {
      if (value.length <= 8) {
        return '***';
      }
      return value.substring(0, 4) + '***' + value.substring(value.length - 4);
    }
    
    return value;
  }

  validateEnvironment(): void {
    console.log('🔍 Validating environment configuration...\n');

    for (const rule of this.rules) {
      const value = process.env[rule.name];

      if (!value) {
        if (rule.required) {
          this.addResult(rule.name, 'missing', `Required environment variable is missing: ${rule.description}`);
        } else {
          this.addResult(rule.name, 'warning', `Optional environment variable is missing: ${rule.description}`);
        }
        continue;
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        this.addResult(
          rule.name, 
          'invalid', 
          `Invalid format: ${rule.description}${rule.example ? ` (example: ${rule.example})` : ''}`,
          value
        );
        continue;
      }

      this.addResult(rule.name, 'valid', rule.description, value);
    }
  }

  checkEnvironmentSpecificRequirements(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    console.log(`🎯 Checking ${nodeEnv} environment specific requirements...\n`);

    switch (nodeEnv) {
      case 'production':
        this.validateProductionRequirements();
        break;
      case 'test':
        this.validateTestRequirements();
        break;
      case 'development':
        this.validateDevelopmentRequirements();
        break;
      default:
        this.addResult('NODE_ENV', 'warning', `Unknown NODE_ENV: ${nodeEnv}`);
    }
  }

  private validateProductionRequirements(): void {
    const productionRequired = [
      'DATABASE_URL',
      'JWT_SECRET',
      'SESSION_SECRET'
    ];

    for (const envVar of productionRequired) {
      if (!process.env[envVar]) {
        this.addResult(envVar, 'invalid', `Required for production environment`);
      }
    }

    // Check for development-only values in production
    if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-here') {
      this.addResult('JWT_SECRET', 'invalid', 'Using default development JWT secret in production');
    }

    if (process.env.DATABASE_URL?.includes('localhost')) {
      this.addResult('DATABASE_URL', 'warning', 'Using localhost database in production');
    }
  }

  private validateTestRequirements(): void {
    // Test environment should have minimal requirements
    if (!process.env.DATABASE_URL) {
      this.addResult('DATABASE_URL', 'warning', 'Test database not configured');
    }
  }

  private validateDevelopmentRequirements(): void {
    // Development environment recommendations
    if (!process.env.OPENAI_API_KEY) {
      this.addResult('OPENAI_API_KEY', 'warning', 'AI features will not work without OpenAI API key');
    }
  }

  generateReport(): void {
    console.log('📊 Environment Validation Report');
    console.log('================================\n');

    const valid = this.results.filter(r => r.status === 'valid').length;
    const invalid = this.results.filter(r => r.status === 'invalid').length;
    const missing = this.results.filter(r => r.status === 'missing').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    console.log(`✅ Valid: ${valid}`);
    console.log(`❌ Invalid: ${invalid}`);
    console.log(`🚫 Missing: ${missing}`);
    console.log(`⚠️ Warnings: ${warnings}\n`);

    // Group results by status
    const groupedResults = this.results.reduce((acc, result) => {
      if (!acc[result.status]) acc[result.status] = [];
      acc[result.status].push(result);
      return acc;
    }, {} as Record<string, ValidationResult[]>);

    // Show critical issues first
    if (groupedResults.invalid) {
      console.log('❌ Invalid Configuration:');
      groupedResults.invalid.forEach(result => {
        console.log(`  • ${result.variable}: ${result.message}`);
      });
      console.log();
    }

    if (groupedResults.missing) {
      console.log('🚫 Missing Required Variables:');
      groupedResults.missing.forEach(result => {
        console.log(`  • ${result.variable}: ${result.message}`);
      });
      console.log();
    }

    if (groupedResults.warning) {
      console.log('⚠️ Warnings:');
      groupedResults.warning.forEach(result => {
        console.log(`  • ${result.variable}: ${result.message}`);
      });
      console.log();
    }

    if (groupedResults.valid) {
      console.log('✅ Valid Configuration:');
      groupedResults.valid.forEach(result => {
        console.log(`  • ${result.variable}: ${result.message}`);
      });
      console.log();
    }
  }

  run(): void {
    this.validateEnvironment();
    this.checkEnvironmentSpecificRequirements();
    this.generateReport();

    const hasErrors = this.results.some(r => r.status === 'invalid' || r.status === 'missing');
    
    if (hasErrors) {
      console.log('❌ Environment validation failed');
      process.exit(1);
    } else {
      console.log('✅ Environment validation passed');
      process.exit(0);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new EnvironmentValidator();
  validator.run();
}

export { EnvironmentValidator };
