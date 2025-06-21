#!/usr/bin/env node

console.log('🚀 Running pre-start checks...\n');

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'NODE_ENV',
];

const optionalButImportant = [
  'OPENAI_API_KEY',
  'SENDGRID_API_KEY',
  'ALLOWED_ORIGINS',
  'REDIS_URL',
  'GA4_CREDENTIALS_JSON',
  'SENTRY_DSN',
];

// Check Node version
const nodeVersion = process.version;
console.log(`Node.js version: ${nodeVersion}`);
if (!nodeVersion.match(/^v(18|19|20|21|22|23|24)/)) {
  console.warn('⚠️  WARNING: Node.js 18+ recommended');
}

// Check required environment variables
console.log('\n📋 Checking required environment variables:');
const missing = [];

requiredEnvVars.forEach(key => {
  process.stdout.write(`  ${key}... `);
  if (process.env[key]) {
    console.log('✅');
  } else {
    console.log('❌ MISSING');
    missing.push(key);
  }
});

if (missing.length > 0) {
  console.error(`\n❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('\nPlease set these variables before starting the application.');
  process.exit(1);
}

// Check optional environment variables
console.log('\n📋 Checking optional environment variables:');
const missingOptional = [];

optionalButImportant.forEach(key => {
  process.stdout.write(`  ${key}... `);
  if (process.env[key]) {
    console.log('✅');
  } else {
    console.log('⚠️  not set');
    missingOptional.push(key);
  }
});

if (missingOptional.length > 0) {
  console.warn(`\n⚠️  WARNING: Missing optional environment variables:`);
  missingOptional.forEach(key => {
    console.warn(`  - ${key}`);
  });
  console.warn('\nSome features may not work correctly.');
}

// Validate DATABASE_URL format
console.log('\n🔍 Validating DATABASE_URL...');
if (!process.env.DATABASE_URL.startsWith('postgres://') && 
    !process.env.DATABASE_URL.startsWith('postgresql://')) {
  console.error('❌ FATAL: DATABASE_URL must be a valid PostgreSQL connection string');
  process.exit(1);
}

// Production-specific checks
if (process.env.NODE_ENV === 'production') {
  console.log('\n🏭 Running production checks...');
  
  // Check SSL mode
  if (!process.env.DATABASE_URL.includes('sslmode=require') && 
      !process.env.DATABASE_URL.includes('ssl=true')) {
    console.warn('⚠️  WARNING: DATABASE_URL should include sslmode=require for production');
    console.warn('   Add ?sslmode=require to your connection string');
  }
  
  // Check ALLOWED_ORIGINS
  if (!process.env.ALLOWED_ORIGINS) {
    console.error('❌ FATAL: ALLOWED_ORIGINS must be set in production');
    process.exit(1);
  }
  
  if (process.env.ALLOWED_ORIGINS === '*') {
    console.error('❌ FATAL: ALLOWED_ORIGINS cannot be * in production');
    process.exit(1);
  }
  
  // Validate origins format
  const origins = process.env.ALLOWED_ORIGINS.split(',');
  origins.forEach(origin => {
    try {
      new URL(origin.trim());
    } catch (err) {
      console.error(`❌ FATAL: Invalid origin in ALLOWED_ORIGINS: ${origin}`);
      process.exit(1);
    }
  });
  
  // Check JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ FATAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

console.log('\n✅ All pre-start checks passed');
console.log('🚀 Ready to start application\n');