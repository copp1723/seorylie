#!/usr/bin/env node

/**
 * Security Audit Script for SEORYLIE Project
 * 
 * This script performs comprehensive security checks including:
 * - Dependency vulnerability scanning
 * - Hardcoded secret detection
 * - Environment configuration validation
 * - File permission checks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityAuditor {
  constructor() {
    this.findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };
    this.projectRoot = process.cwd();
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, details };
    
    this.findings[level].push(logEntry);
    
    const colors = {
      critical: '\x1b[41m\x1b[37m', // Red background, white text
      high: '\x1b[31m',           // Red text
      medium: '\x1b[33m',         // Yellow text
      low: '\x1b[36m',            // Cyan text
      info: '\x1b[32m'            // Green text
    };
    
    const reset = '\x1b[0m';
    console.log(`${colors[level]}[${level.toUpperCase()}]${reset} ${message}`);
    if (details) {
      console.log(`  ${JSON.stringify(details, null, 2)}`);
    }
  }

  async runNpmAudit() {
    this.log('info', 'Running npm audit...');
    
    try {
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      });
      
      const auditData = JSON.parse(auditOutput);
      
      if (auditData.vulnerabilities) {
        const vulnCount = Object.keys(auditData.vulnerabilities).length;
        
        if (vulnCount === 0) {
          this.log('info', 'No vulnerabilities found in dependencies');
        } else {
          this.log('high', `Found ${vulnCount} vulnerable dependencies`, auditData.vulnerabilities);
        }
      }
      
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          const vulnLevels = auditData.metadata?.vulnerabilities || {};
          
          Object.entries(vulnLevels).forEach(([level, count]) => {
            if (count > 0) {
              const logLevel = level === 'critical' ? 'critical' : 
                              level === 'high' ? 'high' : 
                              level === 'moderate' ? 'medium' : 'low';
              this.log(logLevel, `Found ${count} ${level} vulnerabilities`);
            }
          });
          
        } catch (parseError) {
          this.log('medium', 'Failed to parse npm audit output', error.message);
        }
      }
    }
  }

  scanForHardcodedSecrets() {
    this.log('info', 'Scanning for hardcoded secrets...');
    
    const secretPatterns = [
      { name: 'API Key', pattern: /api[_-]?key['"]\s*[:=]\s*['"][^'"]+['"]/i },
      { name: 'Secret Key', pattern: /secret[_-]?key['"]\s*[:=]\s*['"][^'"]+['"]/i },
      { name: 'Password', pattern: /password['"]\s*[:=]\s*['"][^'"]+['"]/i },
      { name: 'Token', pattern: /token['"]\s*[:=]\s*['"][^'"]+['"]/i },
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
      { name: 'Private Key', pattern: /-----BEGIN.*PRIVATE KEY-----/g },
      { name: 'Database URL', pattern: /(postgres|mysql|mongodb):\/\/[^\/\s]+/g }
    ];

    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
    const includeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.json', '.env'];
    
    this.scanDirectory(this.projectRoot, secretPatterns, excludeDirs, includeExtensions);
  }

  scanDirectory(dir, patterns, excludeDirs, includeExtensions) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(this.projectRoot, fullPath);
      
      if (excludeDirs.some(excludeDir => relativePath.includes(excludeDir))) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(fullPath, patterns, excludeDirs, includeExtensions);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (includeExtensions.includes(ext) || item.startsWith('.env')) {
          this.scanFile(fullPath, patterns);
        }
      }
    }
  }

  scanFile(filePath, patterns) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Skip .env.example files as they contain template values
      if (relativePath.includes('.env.example')) {
        return;
      }
      
      patterns.forEach(({ name, pattern }) => {
        const matches = content.match(pattern);
        if (matches) {
          this.log('high', `Potential ${name} found in ${relativePath}`, {
            file: relativePath,
            matches: matches.slice(0, 3) // Limit to first 3 matches
          });
        }
      });
      
    } catch (error) {
      this.log('low', `Failed to scan file: ${filePath}`, error.message);
    }
  }

  validateEnvironmentConfig() {
    this.log('info', 'Validating environment configuration...');
    
    const envExample = path.join(this.projectRoot, '.env.example');
    const envFile = path.join(this.projectRoot, '.env');
    
    if (!fs.existsSync(envExample)) {
      this.log('medium', '.env.example file not found');
      return;
    }
    
    try {
      const exampleContent = fs.readFileSync(envExample, 'utf8');
      const requiredVars = exampleContent
        .split('\n')
        .filter(line => line.includes('=') && !line.startsWith('#'))
        .map(line => line.split('=')[0].trim());
      
      this.log('info', `Found ${requiredVars.length} environment variables in .env.example`);
      
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        const setVars = envContent
          .split('\n')
          .filter(line => line.includes('=') && !line.startsWith('#'))
          .map(line => line.split('=')[0].trim());
        
        const missingVars = requiredVars.filter(varName => !setVars.includes(varName));
        
        if (missingVars.length > 0) {
          this.log('medium', 'Missing environment variables in .env', { missing: missingVars });
        } else {
          this.log('info', 'All required environment variables are present in .env');
        }
      } else {
        this.log('medium', '.env file not found - copy from .env.example');
      }
      
    } catch (error) {
      this.log('medium', 'Failed to validate environment config', error.message);
    }
  }

  checkFilePermissions() {
    this.log('info', 'Checking file permissions...');
    
    const sensitiveFiles = ['.env', '.env.local', '.env.production'];
    
    sensitiveFiles.forEach(filename => {
      const filePath = path.join(this.projectRoot, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const mode = stats.mode & parseInt('777', 8);
        
        // Check if file is readable by others (should be 600 or 644 max)
        if (mode & parseInt('044', 8)) {
          this.log('medium', `${filename} may be readable by others`, { permissions: mode.toString(8) });
        } else {
          this.log('info', `${filename} has appropriate permissions`);
        }
      }
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('SECURITY AUDIT REPORT');
    console.log('='.repeat(60));
    
    const totalFindings = Object.values(this.findings).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log(`\nTotal Findings: ${totalFindings}`);
    
    Object.entries(this.findings).forEach(([level, findings]) => {
      if (findings.length > 0) {
        console.log(`\n${level.toUpperCase()}: ${findings.length} findings`);
        findings.forEach((finding, index) => {
          console.log(`  ${index + 1}. ${finding.message}`);
        });
      }
    });
    
    console.log('\n' + '='.repeat(60));
    
    // Return summary for programmatic use
    return {
      summary: {
        critical: this.findings.critical.length,
        high: this.findings.high.length,
        medium: this.findings.medium.length,
        low: this.findings.low.length,
        info: this.findings.info.length
      },
      findings: this.findings
    };
  }

  async run() {
    console.log('🔍 Starting Security Audit for SEORYLIE Project\n');
    
    await this.runNpmAudit();
    this.scanForHardcodedSecrets();
    this.validateEnvironmentConfig();
    this.checkFilePermissions();
    
    return this.generateReport();
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.run().then(report => {
    const { critical, high } = report.summary;
    const exitCode = critical > 0 ? 2 : high > 0 ? 1 : 0;
    process.exit(exitCode);
  }).catch(error => {
    console.error('Audit failed:', error);
    process.exit(3);
  });
}

module.exports = SecurityAuditor;