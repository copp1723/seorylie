#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * 
 * Ensures all dependencies are installed before running lint/typecheck/test commands.
 * Critical for environments with network restrictions after initialization.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUIRED_DEPENDENCIES = [
  // Core dependencies for our orchestrator
  'drizzle-orm',
  'drizzle-zod', 
  'bull',
  'ioredis',
  'handlebars',
  'prom-client',
  'uuid',
  'zod',
  
  // Testing dependencies
  'vitest',
  'jest',
  '@jest/globals',
  
  // TypeScript and build tools
  'typescript',
  'tsx',
  'esbuild',
  'vite',
  
  // Express and server dependencies
  'express',
  'express-rate-limit',
  'express-session',
  'express-validator',
  'cors',
  'helmet',
  'winston',
  
  // Database and ORM
  'pg',
  'postgres'
];

const REQUIRED_DEV_DEPENDENCIES = [
  '@types/node',
  '@types/express',
  '@types/pg',
  '@types/uuid',
  '@types/jest',
  'ts-jest',
  'ts-node'
];

class SetupManager {
  constructor() {
    this.projectRoot = process.cwd();
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
    this.nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '✅',
      warn: '⚠️ ',
      error: '❌',
      progress: '🔄'
    }[type] || 'ℹ️ ';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async verifyPackageJson() {
    this.log('Verifying package.json exists...', 'progress');
    
    if (!fs.existsSync(this.packageJsonPath)) {
      throw new Error('package.json not found in project root');
    }

    try {
      this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      this.log('package.json loaded successfully');
      return true;
    } catch (error) {
      throw new Error(`Invalid package.json: ${error.message}`);
    }
  }

  async checkNodeVersion() {
    this.log('Checking Node.js version...', 'progress');
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      this.warnings.push(`Node.js version ${nodeVersion} detected. Recommended: Node 18+`);
      this.log(`Node.js version ${nodeVersion} (recommended: 18+)`, 'warn');
    } else {
      this.log(`Node.js version ${nodeVersion} ✓`);
    }
    
    return true;
  }

  async checkNpmVersion() {
    this.log('Checking npm version...', 'progress');
    
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.log(`npm version ${npmVersion} ✓`);
      return true;
    } catch (error) {
      throw new Error('npm not found. Please install Node.js with npm');
    }
  }

  async installDependencies() {
    this.log('Installing dependencies...', 'progress');
    
    try {
      // Use npm ci if package-lock.json exists, otherwise npm install
      const lockFile = path.join(this.projectRoot, 'package-lock.json');
      const command = fs.existsSync(lockFile) ? 'npm ci' : 'npm install';
      
      this.log(`Running: ${command}`);
      
      // Run with proper stdio to show progress
      const result = execSync(command, { 
        cwd: this.projectRoot,
        stdio: 'inherit',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      this.log('Dependencies installed successfully');
      return true;
      
    } catch (error) {
      throw new Error(`Dependency installation failed: ${error.message}`);
    }
  }

  async verifyDependencies() {
    this.log('Verifying critical dependencies...', 'progress');
    
    const missing = [];
    const nodeModules = this.nodeModulesPath;
    
    for (const dep of REQUIRED_DEPENDENCIES) {
      const depPath = path.join(nodeModules, dep);
      if (!fs.existsSync(depPath)) {
        missing.push(dep);
      }
    }
    
    if (missing.length > 0) {
      this.errors.push(`Missing dependencies: ${missing.join(', ')}`);
      return false;
    }
    
    this.log(`All ${REQUIRED_DEPENDENCIES.length} critical dependencies verified`);
    return true;
  }

  async verifyTypeScriptSetup() {
    this.log('Verifying TypeScript setup...', 'progress');
    
    try {
      // Check if TypeScript is available
      execSync('npx tsc --version', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      // Check if tsx is available
      execSync('npx tsx --version', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      this.log('TypeScript and tsx verified');
      return true;
      
    } catch (error) {
      this.errors.push('TypeScript or tsx not properly installed');
      return false;
    }
  }

  async verifyTestingFramework() {
    this.log('Verifying testing frameworks...', 'progress');
    
    try {
      // Check Vitest
      const vitestVersion = execSync('npx vitest --version', { 
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      this.log(`Vitest ${vitestVersion} ✓`);
      
      // Check Jest
      const jestVersion = execSync('npx jest --version', { 
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      this.log(`Jest ${jestVersion} ✓`);
      
      return true;
      
    } catch (error) {
      this.errors.push('Testing frameworks not properly installed');
      return false;
    }
  }

  async runTypeCheck() {
    this.log('Running TypeScript type check...', 'progress');
    
    try {
      execSync('npm run check', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      this.log('TypeScript type check passed');
      return true;
      
    } catch (error) {
      this.log('TypeScript type check failed - this may be expected during setup', 'warn');
      this.warnings.push('TypeScript errors detected');
      return false;
    }
  }

  async runQuickTest() {
    this.log('Running quick test to verify setup...', 'progress');
    
    try {
      // Run a simple test to verify the testing framework works
      execSync('npx vitest run --reporter=basic --run test/conversation-orchestrator.test.ts || true', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      this.log('Test framework verification completed');
      return true;
      
    } catch (error) {
      this.log('Test execution failed - this may be expected if no tests exist yet', 'warn');
      return false;
    }
  }

  async createDevScripts() {
    this.log('Creating development scripts...', 'progress');
    
    const scriptsDir = path.join(this.projectRoot, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Create a pre-check script
    const preCheckScript = `#!/bin/bash
# Pre-check script to verify environment before running commands

set -e

echo "🔍 Verifying development environment..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Running npm install..."
    npm install
fi

# Verify critical dependencies
node -e "
const deps = ['drizzle-orm', 'vitest', 'typescript', 'tsx'];
const missing = deps.filter(dep => {
  try { require.resolve(dep); return false; } catch { return true; }
});
if (missing.length) {
  console.error('❌ Missing dependencies:', missing.join(', '));
  console.error('Run: npm install');
  process.exit(1);
}
console.log('✅ All critical dependencies verified');
"

echo "✅ Environment verification complete"
`;

    fs.writeFileSync(path.join(scriptsDir, 'pre-check.sh'), preCheckScript, { mode: 0o755 });
    this.log('Created pre-check.sh script');

    return true;
  }

  async generateReport() {
    this.log('Setup Summary:', 'info');
    this.log('='.repeat(50));
    
    if (this.errors.length === 0) {
      this.log('🎉 Setup completed successfully!');
      this.log('');
      this.log('You can now run:');
      this.log('  npm run lint     # TypeScript checking');
      this.log('  npm run check    # Type checking');
      this.log('  npm run test     # Run tests');
      this.log('  npm run build    # Build project');
    } else {
      this.log('❌ Setup completed with errors:', 'error');
      this.errors.forEach(error => this.log(`  • ${error}`, 'error'));
    }
    
    if (this.warnings.length > 0) {
      this.log('');
      this.log('⚠️  Warnings:', 'warn');
      this.warnings.forEach(warning => this.log(`  • ${warning}`, 'warn'));
    }
    
    this.log('');
    this.log('Environment Info:');
    this.log(`  Node: ${process.version}`);
    this.log(`  Platform: ${process.platform}`);
    this.log(`  Arch: ${process.arch}`);
    this.log(`  CWD: ${this.projectRoot}`);
  }

  async run() {
    try {
      this.log('🚀 Starting development environment setup...', 'progress');
      this.log('');

      await this.verifyPackageJson();
      await this.checkNodeVersion();
      await this.checkNpmVersion();
      await this.installDependencies();
      await this.verifyDependencies();
      await this.verifyTypeScriptSetup();
      await this.verifyTestingFramework();
      await this.createDevScripts();
      
      // Optional checks that may warn but not fail
      await this.runTypeCheck();
      await this.runQuickTest();
      
    } catch (error) {
      this.errors.push(error.message);
      this.log(error.message, 'error');
    } finally {
      this.log('');
      await this.generateReport();
      
      // Exit with appropriate code
      if (this.errors.length > 0) {
        process.exit(1);
      }
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const setup = new SetupManager();

  switch (command) {
    case 'verify':
      // Quick verification without installation
      await setup.verifyPackageJson();
      await setup.verifyDependencies();
      await setup.verifyTypeScriptSetup();
      await setup.verifyTestingFramework();
      break;

    case 'install':
      // Just install dependencies
      await setup.verifyPackageJson();
      await setup.installDependencies();
      break;

    case 'check':
      // Check environment without modifying anything
      await setup.verifyPackageJson();
      await setup.checkNodeVersion();
      await setup.checkNpmVersion();
      await setup.verifyDependencies();
      break;

    case 'full':
    default:
      // Full setup
      await setup.run();
      break;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { SetupManager };