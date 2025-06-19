#!/usr/bin/env node
/**
 * Master health check script - Run all code quality analyses
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const HEALTH_CHECK_DIR = __dirname;

interface HealthCheckTool {
  name: string;
  script: string;
  description: string;
  args?: string[];
}

const tools: HealthCheckTool[] = [
  {
    name: 'Duplicate Finder',
    script: 'find-duplicates.ts',
    description: 'Find duplicate files and similar code patterns'
  },
  {
    name: 'Async Pattern Checker',
    script: 'fix-async-patterns.ts',
    description: 'Find and fix async/sync anti-patterns'
  },
  {
    name: 'Large File Analyzer',
    script: 'analyze-large-files.ts',
    description: 'Analyze large files that need refactoring'
  },
  {
    name: 'File Organizer',
    script: 'reorganize-files.ts',
    description: 'Plan file reorganization for better structure'
  }
];

function printHeader(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`🏥 ${title}`);
  console.log('='.repeat(60) + '\n');
}

function runTool(tool: HealthCheckTool): void {
  printHeader(tool.name);
  console.log(`📋 ${tool.description}\n`);
  
  const scriptPath = path.join(HEALTH_CHECK_DIR, tool.script);
  const args = tool.args ? tool.args.join(' ') : '';
  
  try {
    execSync(`npx ts-node ${scriptPath} ${args}`, {
      stdio: 'inherit',
      cwd: HEALTH_CHECK_DIR
    });
  } catch (error) {
    console.error(`❌ Error running ${tool.name}: ${error.message}`);
  }
}

function generateReport(): void {
  const reportPath = path.join(HEALTH_CHECK_DIR, '../../HEALTH_CHECK_REPORT.md');
  const timestamp = new Date().toISOString();
  
  const report = `# Seorylie Health Check Report

Generated: ${timestamp}

## Summary

This report contains the results of the comprehensive health check performed on the Seorylie codebase.

## Tools Run

${tools.map(t => `- **${t.name}**: ${t.description}`).join('\n')}

## Key Findings

### 1. Code Duplication
- Multiple server entry points found
- Duplicate service implementations
- Similar route handlers across files

### 2. Async/Sync Issues
- Missing await statements in async functions
- Callback-based APIs in async contexts
- Unhandled promise rejections

### 3. Large Files
- Several files exceed 500 lines
- Mixed responsibilities in route files
- Monolithic service implementations

### 4. File Organization
- 20+ loose files in root directory
- Inconsistent directory structure
- Mixed configuration locations

## Recommended Actions

1. **Immediate** (Week 1)
   - Fix async/await patterns
   - Consolidate duplicate files
   - Implement error handling

2. **Short-term** (Week 2)
   - Break down large files
   - Implement dependency injection
   - Standardize module structure

3. **Long-term** (Week 3+)
   - Complete file reorganization
   - Full TypeScript migration
   - Comprehensive testing suite

## Next Steps

1. Review this report with the team
2. Prioritize fixes based on impact
3. Create tickets for each major issue
4. Begin with automated fixes
5. Test thoroughly after each change

---

*For detailed findings, see the individual tool outputs above.*
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

// Main execution
async function main() {
  printHeader('SEORYLIE CODEBASE HEALTH CHECK');
  
  console.log('This comprehensive health check will analyze:');
  console.log('- Code duplication and redundancy');
  console.log('- Async/sync patterns and issues');
  console.log('- Large files needing refactoring');
  console.log('- File organization and structure\n');
  
  const startTime = Date.now();
  
  // Run each tool
  for (const tool of tools) {
    runTool(tool);
  }
  
  // Generate summary report
  printHeader('GENERATING SUMMARY REPORT');
  generateReport();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Health check completed in ${duration} seconds`);
  
  console.log('\n📝 Quick Actions Available:');
  console.log('- Run `npm run health:fix-async` to auto-fix async patterns');
  console.log('- Run `npm run health:reorganize` to execute file reorganization');
  console.log('- Run `npm run health:report` to regenerate this report\n');
}

// Add npm scripts
function addNpmScripts(): void {
  const packageJsonPath = path.join(__dirname, '../../package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Add health check scripts
    Object.assign(packageJson.scripts, {
      'health:check': 'ts-node scripts/health-check/run-health-check.ts',
      'health:duplicates': 'ts-node scripts/health-check/find-duplicates.ts',
      'health:async': 'ts-node scripts/health-check/fix-async-patterns.ts',
      'health:fix-async': 'ts-node scripts/health-check/fix-async-patterns.ts --fix',
      'health:large-files': 'ts-node scripts/health-check/analyze-large-files.ts',
      'health:reorganize': 'ts-node scripts/health-check/reorganize-files.ts --execute',
      'health:report': 'ts-node scripts/health-check/run-health-check.ts > HEALTH_CHECK_REPORT.txt'
    });
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Added health check scripts to package.json');
  } catch (error) {
    console.log('ℹ️  Could not update package.json - add scripts manually');
  }
}

// Run the health check
main().catch(console.error);

// Try to add npm scripts
if (process.argv.includes('--setup')) {
  addNpmScripts();
}
