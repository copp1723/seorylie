#!/usr/bin/env tsx

/**
 * Health Check Script for CleanRylie Platform
 * 
 * This script validates the health of all required services and dependencies
 * Used by CI/CD pipeline and local development
 */

import { createConnection } from 'postgres';
import { createClient } from 'redis';
import { readFileSync } from 'fs';
import { join } from 'path';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

class HealthChecker {
  private results: HealthCheckResult[] = [];

  private addResult(service: string, status: 'healthy' | 'unhealthy' | 'warning', message: string, details?: any) {
    this.results.push({
      service,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  async checkEnvironment(): Promise<void> {
    console.log('🔍 Checking environment configuration...');
    
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET'
    ];

    const optionalEnvVars = [
      'REDIS_URL',
      'OPENAI_API_KEY',
      'NODE_ENV'
    ];

    let missingRequired = 0;
    let missingOptional = 0;

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.addResult('Environment', 'unhealthy', `Missing required environment variable: ${envVar}`);
        missingRequired++;
      }
    }

    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        this.addResult('Environment', 'warning', `Missing optional environment variable: ${envVar}`);
        missingOptional++;
      }
    }

    if (missingRequired === 0) {
      this.addResult('Environment', 'healthy', `All required environment variables are set`);
    }

    console.log(`✅ Environment check completed (${missingRequired} missing required, ${missingOptional} missing optional)`);
  }

  async checkDatabase(): Promise<void> {
    console.log('🗄️ Checking database connection...');
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.addResult('Database', 'unhealthy', 'DATABASE_URL not configured');
      return;
    }

    try {
      const sql = createConnection(databaseUrl);
      
      // Test basic connectivity
      const result = await sql`SELECT 1 as test, NOW() as timestamp`;
      
      if (result.length > 0) {
        this.addResult('Database', 'healthy', 'Database connection successful', {
          timestamp: result[0].timestamp,
          url: databaseUrl.replace(/:[^:@]*@/, ':***@') // Hide password
        });
      }

      await sql.end();
      console.log('✅ Database connection successful');
    } catch (error) {
      this.addResult('Database', 'unhealthy', 'Database connection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      console.log('❌ Database connection failed:', error);
    }
  }

  async checkRedis(): Promise<void> {
    console.log('🔴 Checking Redis connection...');
    
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      const client = createClient({ url: redisUrl });
      
      client.on('error', (err) => {
        console.log('Redis Client Error', err);
      });

      await client.connect();
      
      // Test basic operations
      await client.set('health_check', 'ok');
      const result = await client.get('health_check');
      await client.del('health_check');
      
      if (result === 'ok') {
        this.addResult('Redis', 'healthy', 'Redis connection and operations successful', {
          url: redisUrl.replace(/:[^:@]*@/, ':***@') // Hide password if any
        });
        console.log('✅ Redis connection successful');
      }

      await client.quit();
    } catch (error) {
      this.addResult('Redis', 'warning', 'Redis connection failed (optional service)', {
        error: error instanceof Error ? error.message : String(error)
      });
      console.log('⚠️ Redis connection failed (optional):', error);
    }
  }

  async checkPackageIntegrity(): Promise<void> {
    console.log('📦 Checking package integrity...');
    
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      
      // Check for problematic dependencies
      const problematicDeps = ['json_pp']; // Add more as needed
      const foundProblematic: string[] = [];
      
      for (const dep of problematicDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          foundProblematic.push(dep);
        }
      }
      
      if (foundProblematic.length > 0) {
        this.addResult('Package', 'unhealthy', 'Found problematic dependencies', {
          problematicDependencies: foundProblematic
        });
      } else {
        this.addResult('Package', 'healthy', 'Package.json is clean');
      }

      // Check for required scripts
      const requiredScripts = ['build', 'start', 'test'];
      const missingScripts: string[] = [];
      
      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          missingScripts.push(script);
        }
      }
      
      if (missingScripts.length > 0) {
        this.addResult('Package', 'warning', 'Missing recommended scripts', {
          missingScripts
        });
      }

      console.log('✅ Package integrity check completed');
    } catch (error) {
      this.addResult('Package', 'unhealthy', 'Failed to read package.json', {
        error: error instanceof Error ? error.message : String(error)
      });
      console.log('❌ Package integrity check failed:', error);
    }
  }

  async checkFileSystem(): Promise<void> {
    console.log('📁 Checking file system...');
    
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'server/index.ts',
      'client/src/main.tsx'
    ];

    const requiredDirs = [
      'server',
      'client',
      'shared',
      'scripts'
    ];

    let missingFiles = 0;
    let missingDirs = 0;

    for (const file of requiredFiles) {
      try {
        readFileSync(file);
      } catch {
        this.addResult('FileSystem', 'warning', `Missing file: ${file}`);
        missingFiles++;
      }
    }

    for (const dir of requiredDirs) {
      try {
        readFileSync(join(dir, '.'), { encoding: 'utf-8' });
      } catch {
        this.addResult('FileSystem', 'warning', `Missing directory: ${dir}`);
        missingDirs++;
      }
    }

    if (missingFiles === 0 && missingDirs === 0) {
      this.addResult('FileSystem', 'healthy', 'All required files and directories present');
    }

    console.log(`✅ File system check completed (${missingFiles} missing files, ${missingDirs} missing dirs)`);
  }

  async runAllChecks(): Promise<void> {
    console.log('🏥 Starting comprehensive health check...\n');
    
    await this.checkEnvironment();
    await this.checkPackageIntegrity();
    await this.checkFileSystem();
    await this.checkDatabase();
    await this.checkRedis();
    
    console.log('\n📊 Health Check Summary:');
    console.log('========================');
    
    const healthy = this.results.filter(r => r.status === 'healthy').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const unhealthy = this.results.filter(r => r.status === 'unhealthy').length;
    
    console.log(`✅ Healthy: ${healthy}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`❌ Unhealthy: ${unhealthy}`);
    
    if (process.env.NODE_ENV !== 'test') {
      console.log('\n📋 Detailed Results:');
      console.log(JSON.stringify(this.results, null, 2));
    }
    
    // Exit with appropriate code
    if (unhealthy > 0) {
      console.log('\n❌ Health check failed - critical issues found');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️ Health check completed with warnings');
      process.exit(0);
    } else {
      console.log('\n✅ All health checks passed!');
      process.exit(0);
    }
  }
}

// Run health check if called directly
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runAllChecks().catch((error) => {
    console.error('❌ Health check failed with error:', error);
    process.exit(1);
  });
}

export { HealthChecker };
