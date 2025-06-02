#!/usr/bin/env tsx
/**
 * Repository Fat Trimmer
 * 
 * A comprehensive script to systematically trim fat from the repository by:
 * - Removing unused dependencies
 * - Consolidating redundant scripts
 * - Removing duplicate configurations
 * - Cleaning up legacy files
 * 
 * Usage:
 *   npx tsx scripts/trim-fat.ts [--dry-run] [--no-confirm] [--aggressive]
 * 
 * Options:
 *   --dry-run     Show what would be done without making changes
 *   --no-confirm  Skip confirmation prompts
 *   --aggressive  Use more aggressive fat trimming strategies
 *   --scripts     Only trim package.json scripts
 *   --deps        Only trim dependencies
 *   --configs     Only trim configuration files
 *   --dead-code   Only remove dead code
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { promisify } from 'util';
import { glob } from 'glob';

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, '.backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_CONFIRM = args.includes('--no-confirm');
const AGGRESSIVE = args.includes('--aggressive');
const ONLY_SCRIPTS = args.includes('--scripts');
const ONLY_DEPS = args.includes('--deps');
const ONLY_CONFIGS = args.includes('--configs');
const ONLY_DEAD_CODE = args.includes('--dead-code');

// If no specific area is selected, do all of them
const DO_ALL = !ONLY_SCRIPTS && !ONLY_DEPS && !ONLY_CONFIGS && !ONLY_DEAD_CODE;

// Utility functions
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.log(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  success: (message: string) => console.log(`[SUCCESS] ${message}`),
  dryRun: (message: string) => console.log(`[DRY-RUN] ${message}`)
};

const fileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

const readJsonFile = (filePath: string): any => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Failed to read JSON file: ${filePath}`);
    return null;
  }
};

const writeJsonFile = (filePath: string, data: any): boolean => {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    logger.error(`Failed to write JSON file: ${filePath}`);
    return false;
  }
};

const backupFile = (filePath: string): boolean => {
  try {
    if (!fileExists(filePath)) {
      return false;
    }

    if (!fileExists(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const backupPath = path.join(BACKUP_DIR, `${fileName}.${TIMESTAMP}.bak`);
    
    fs.copyFileSync(filePath, backupPath);
    logger.info(`Created backup: ${backupPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to backup file: ${filePath}`);
    console.error(error);
    return false;
  }
};

const askForConfirmation = async (message: string): Promise<boolean> => {
  if (NO_CONFIRM) return true;
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
};

const findFiles = async (pattern: string, baseDir: string = ROOT_DIR): Promise<string[]> => {
  try {
    const files = await promisify(glob)(pattern, { cwd: baseDir, absolute: false });
    return files.map(f => path.relative(baseDir, path.join(baseDir, f)));
  } catch (error) {
    logger.error(`Failed to find files: ${pattern}`);
    console.error(error);
    return [];
  }
};

const isFileUsed = (filePath: string): boolean => {
  try {
    // This is a simple check that looks for imports of the file
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    
    // Skip node_modules
    if (filePath.includes('node_modules')) {
      return true;
    }
    
    // Skip test files
    if (filePath.includes('test/') || filePath.includes('tests/') || fileName.includes('.test.') || fileName.includes('.spec.')) {
      return true;
    }
    
    // Check if the file is imported anywhere
    const grepCommand = `grep -r "import.*from.*['\\\"].*${fileName.replace('.', '\\.')}['\\\"]" "${ROOT_DIR}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "${filePath}" | wc -l`;
    const result = execSync(grepCommand, { encoding: 'utf8' }).trim();
    
    return parseInt(result, 10) > 0;
  } catch (error) {
    // If there's an error, assume the file is used to be safe
    return true;
  }
};

// Cleanup functions
const trimPackageJsonScripts = async (): Promise<void> => {
  logger.info('Trimming package.json scripts...');
  
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  if (!fileExists(packageJsonPath)) {
    logger.error('package.json not found');
    return;
  }
  
  // Backup package.json
  if (!DRY_RUN) {
    backupFile(packageJsonPath);
  }
  
  const packageJson = readJsonFile(packageJsonPath);
  if (!packageJson || !packageJson.scripts) {
    logger.error('Invalid package.json or no scripts section');
    return;
  }
  
  const originalScripts = { ...packageJson.scripts };
  const scriptCount = Object.keys(originalScripts).length;
  logger.info(`Found ${scriptCount} scripts in package.json`);
  
  // Group scripts by prefix
  const scriptGroups: Record<string, string[]> = {};
  Object.keys(originalScripts).forEach(scriptName => {
    const prefix = scriptName.split(':')[0];
    if (!scriptGroups[prefix]) {
      scriptGroups[prefix] = [];
    }
    scriptGroups[prefix].push(scriptName);
  });
  
  // Find duplicate and similar scripts
  const duplicateCommands: Record<string, string[]> = {};
  Object.entries(originalScripts).forEach(([name, command]) => {
    const cmd = command.toString();
    if (!duplicateCommands[cmd]) {
      duplicateCommands[cmd] = [];
    }
    duplicateCommands[cmd].push(name);
  });
  
  // Scripts to remove
  const scriptsToRemove: string[] = [];
  
  // 1. Find scripts with "|| exit 0" pattern (likely unused)
  Object.entries(originalScripts).forEach(([name, command]) => {
    const cmd = command.toString();
    if (cmd.includes('|| exit 0')) {
      scriptsToRemove.push(name);
    }
  });
  
  // 2. Remove duplicate scripts (keep one from each group)
  Object.entries(duplicateCommands).forEach(([command, scripts]) => {
    if (scripts.length > 1) {
      // Keep the shortest named script
      const sortedScripts = [...scripts].sort((a, b) => a.length - b.length);
      const toKeep = sortedScripts[0];
      const toRemove = sortedScripts.slice(1);
      
      logger.info(`Duplicate command: "${command}"`);
      logger.info(`  Keeping: ${toKeep}`);
      logger.info(`  Removing: ${toRemove.join(', ')}`);
      
      scriptsToRemove.push(...toRemove);
    }
  });
  
  // 3. Consolidate similar scripts in groups with too many scripts
  Object.entries(scriptGroups).forEach(([prefix, scripts]) => {
    if (scripts.length > 3 && !['dev', 'build', 'start'].includes(prefix)) {
      logger.info(`Group "${prefix}" has ${scripts.length} scripts`);
      
      // Keep the main script and remove most others
      const mainScript = scripts.find(s => s === prefix) || scripts[0];
      const toRemove = scripts.filter(s => {
        // Keep the main script
        if (s === mainScript) return false;
        
        // Keep common variations
        if (s === `${prefix}:watch`) return false;
        if (s === `${prefix}:dev`) return false;
        
        // Remove the rest if we're in aggressive mode
        return AGGRESSIVE;
      });
      
      if (toRemove.length > 0) {
        logger.info(`  Keeping: ${mainScript}`);
        logger.info(`  Removing: ${toRemove.join(', ')}`);
        scriptsToRemove.push(...toRemove);
      }
    }
  });
  
  // Remove duplicate entries from scriptsToRemove
  const uniqueScriptsToRemove = [...new Set(scriptsToRemove)];
  
  logger.info(`Found ${uniqueScriptsToRemove.length} scripts to remove`);
  
  if (DRY_RUN) {
    uniqueScriptsToRemove.forEach(script => {
      logger.dryRun(`Would remove script: ${script}: ${originalScripts[script]}`);
    });
    return;
  }
  
  if (uniqueScriptsToRemove.length > 0) {
    const confirmMessage = `Remove ${uniqueScriptsToRemove.length} scripts from package.json?`;
    if (await askForConfirmation(confirmMessage)) {
      // Create new scripts object without the removed scripts
      const newScripts: Record<string, string> = {};
      Object.entries(originalScripts).forEach(([name, command]) => {
        if (!uniqueScriptsToRemove.includes(name)) {
          newScripts[name] = command;
        }
      });
      
      packageJson.scripts = newScripts;
      
      if (writeJsonFile(packageJsonPath, packageJson)) {
        logger.success(`Removed ${uniqueScriptsToRemove.length} scripts from package.json`);
      }
    }
  }
};

const trimDependencies = async (): Promise<void> => {
  logger.info('Trimming dependencies...');
  
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  if (!fileExists(packageJsonPath)) {
    logger.error('package.json not found');
    return;
  }
  
  // Backup package.json
  if (!DRY_RUN) {
    backupFile(packageJsonPath);
  }
  
  const packageJson = readJsonFile(packageJsonPath);
  if (!packageJson) {
    logger.error('Invalid package.json');
    return;
  }
  
  // List of potentially unused dependencies
  const unusedDependencies = [
    // Duplicate test frameworks - standardize on one
    ...(packageJson.dependencies?.jest && packageJson.dependencies?.vitest ? ['jest'] : []),
    ...(packageJson.devDependencies?.jest && packageJson.devDependencies?.vitest ? ['jest'] : []),
    
    // Potentially unused packages based on analysis
    '@bull-board/api',
    '@bull-board/express',
    '@trpc/client',
    '@trpc/tanstack-react-query',
    '@trpc/server',
    'compression',
    'express-jwt',
    'morgan',
    'p-retry',
    'pino',
    'pino-pretty',
    'winston-daily-rotate-file',
    'xml2js'
  ];
  
  // Check each dependency
  const depsToRemove: string[] = [];
  
  // Check dependencies
  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach(dep => {
      if (unusedDependencies.includes(dep)) {
        depsToRemove.push(dep);
      }
    });
  }
  
  // Check devDependencies
  if (packageJson.devDependencies) {
    Object.keys(packageJson.devDependencies).forEach(dep => {
      if (unusedDependencies.includes(dep)) {
        depsToRemove.push(dep);
      }
    });
  }
  
  logger.info(`Found ${depsToRemove.length} potentially unused dependencies`);
  
  if (DRY_RUN) {
    depsToRemove.forEach(dep => {
      logger.dryRun(`Would remove dependency: ${dep}`);
    });
    return;
  }
  
  if (depsToRemove.length > 0) {
    const confirmMessage = `Remove ${depsToRemove.length} potentially unused dependencies?`;
    if (await askForConfirmation(confirmMessage)) {
      // Remove from dependencies
      if (packageJson.dependencies) {
        depsToRemove.forEach(dep => {
          if (packageJson.dependencies[dep]) {
            delete packageJson.dependencies[dep];
          }
        });
      }
      
      // Remove from devDependencies
      if (packageJson.devDependencies) {
        depsToRemove.forEach(dep => {
          if (packageJson.devDependencies[dep]) {
            delete packageJson.devDependencies[dep];
          }
        });
      }
      
      if (writeJsonFile(packageJsonPath, packageJson)) {
        logger.success(`Removed ${depsToRemove.length} dependencies from package.json`);
        logger.info('Run "npm install" to update package-lock.json');
      }
    }
  }
};

const trimConfigFiles = async (): Promise<void> => {
  logger.info('Trimming configuration files...');
  
  // Find redundant configuration files
  const configPatterns = [
    'tsconfig*.json',
    '.eslintrc*',
    'jest.config*',
    'vitest.config*',
    '.env*'
  ];
  
  const configFiles: Record<string, string[]> = {};
  
  for (const pattern of configPatterns) {
    const files = await findFiles(pattern);
    const type = pattern.split('*')[0].replace('.', '');
    configFiles[type] = files;
  }
  
  // Identify redundant files
  const filesToRemove: string[] = [];
  
  // TypeScript configs
  if (configFiles.tsconfig && configFiles.tsconfig.length > 1) {
    logger.info(`Found ${configFiles.tsconfig.length} TypeScript config files`);
    
    // Keep tsconfig.json, remove others if in aggressive mode
    if (AGGRESSIVE) {
      const toKeep = 'tsconfig.json';
      const toRemove = configFiles.tsconfig.filter(f => f !== toKeep);
      
      logger.info(`  Keeping: ${toKeep}`);
      logger.info(`  Removing: ${toRemove.join(', ')}`);
      
      filesToRemove.push(...toRemove);
    }
  }
  
  // Test configs - standardize on one test framework
  if ((configFiles.jest && configFiles.jest.length > 0) && 
      (configFiles.vitest && configFiles.vitest.length > 0)) {
    logger.info('Found both Jest and Vitest configurations');
    
    // In aggressive mode, standardize on Vitest (newer)
    if (AGGRESSIVE) {
      logger.info('  Standardizing on Vitest (removing Jest configs)');
      filesToRemove.push(...configFiles.jest);
    }
  }
  
  // Environment files
  if (configFiles.env && configFiles.env.length > 2) {
    logger.info(`Found ${configFiles.env.length} environment files`);
    
    // Keep .env and .env.example, remove others if in aggressive mode
    if (AGGRESSIVE) {
      const toKeep = ['.env', '.env.example'];
      const toRemove = configFiles.env.filter(f => !toKeep.includes(f));
      
      logger.info(`  Keeping: ${toKeep.join(', ')}`);
      logger.info(`  Removing: ${toRemove.join(', ')}`);
      
      filesToRemove.push(...toRemove);
    }
  }
  
  logger.info(`Found ${filesToRemove.length} redundant configuration files`);
  
  if (DRY_RUN) {
    filesToRemove.forEach(file => {
      logger.dryRun(`Would remove config file: ${file}`);
    });
    return;
  }
  
  for (const file of filesToRemove) {
    const filePath = path.join(ROOT_DIR, file);
    
    if (fileExists(filePath)) {
      const confirmMessage = `Remove redundant config file: ${file}?`;
      if (await askForConfirmation(confirmMessage)) {
        // Backup first
        backupFile(filePath);
        
        try {
          fs.unlinkSync(filePath);
          logger.success(`Removed: ${file}`);
        } catch (error) {
          logger.error(`Failed to remove file: ${file}`);
          console.error(error);
        }
      }
    }
  }
};

const removeDeadCode = async (): Promise<void> => {
  logger.info('Analyzing for dead code...');
  
  // Find potential dead code files
  const patterns = [
    // Unused test files
    'test/**/*.{js,ts}',
    'tests/**/*.{js,ts}',
    'cypress/**/*.{js,ts}',
    
    // Potentially unused utility files
    'utils/**/*.{js,ts}',
    'helpers/**/*.{js,ts}',
    
    // Potentially unused middleware
    'server/middleware/**/*.{js,ts}',
    
    // Potentially unused types
    'types/**/*.{js,ts,d.ts}',
    'server/types/**/*.{js,ts,d.ts}'
  ];
  
  const potentialDeadFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await findFiles(pattern);
    potentialDeadFiles.push(...files);
  }
  
  logger.info(`Found ${potentialDeadFiles.length} files to analyze for usage`);
  
  // Check which files are actually used
  const deadFiles: string[] = [];
  
  for (const file of potentialDeadFiles) {
    const filePath = path.join(ROOT_DIR, file);
    
    if (!fileExists(filePath)) {
      continue;
    }
    
    // Skip critical files
    if (file.includes('index.ts') || file.includes('index.js')) {
      continue;
    }
    
    try {
      const isUsed = isFileUsed(filePath);
      
      if (!isUsed) {
        deadFiles.push(file);
      }
    } catch (error) {
      logger.error(`Error checking if file is used: ${file}`);
      console.error(error);
    }
  }
  
  logger.info(`Found ${deadFiles.length} potentially unused files`);
  
  if (DRY_RUN) {
    deadFiles.forEach(file => {
      logger.dryRun(`Would remove unused file: ${file}`);
    });
    return;
  }
  
  // Only remove dead files in aggressive mode
  if (AGGRESSIVE && deadFiles.length > 0) {
    const confirmMessage = `Remove ${deadFiles.length} potentially unused files?`;
    if (await askForConfirmation(confirmMessage)) {
      for (const file of deadFiles) {
        const filePath = path.join(ROOT_DIR, file);
        
        // Backup first
        backupFile(filePath);
        
        try {
          fs.unlinkSync(filePath);
          logger.success(`Removed: ${file}`);
        } catch (error) {
          logger.error(`Failed to remove file: ${file}`);
          console.error(error);
        }
      }
    }
  } else if (!AGGRESSIVE && deadFiles.length > 0) {
    logger.info('Skipping dead code removal. Use --aggressive to remove unused files.');
    deadFiles.forEach(file => {
      logger.info(`  Potentially unused: ${file}`);
    });
  }
};

// Main function
const main = async () => {
  logger.info(`Starting fat trimming (dry-run: ${DRY_RUN}, no-confirm: ${NO_CONFIRM}, aggressive: ${AGGRESSIVE})`);
  
  // Create a backup branch for safety
  if (!DRY_RUN) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupBranch = `backup/pre-trim-${timestamp}`;
    
    try {
      execSync(`git checkout -b ${backupBranch}`);
      logger.success(`Created backup branch: ${backupBranch}`);
      execSync('git checkout -');
    } catch (error) {
      logger.warn('Failed to create backup branch. Continuing anyway...');
    }
  }
  
  // Run cleanup tasks
  if (DO_ALL || ONLY_SCRIPTS) {
    await trimPackageJsonScripts();
  }
  
  if (DO_ALL || ONLY_DEPS) {
    await trimDependencies();
  }
  
  if (DO_ALL || ONLY_CONFIGS) {
    await trimConfigFiles();
  }
  
  if (DO_ALL || ONLY_DEAD_CODE) {
    await removeDeadCode();
  }
  
  logger.success('Fat trimming complete!');
  
  if (DRY_RUN) {
    logger.info('This was a dry run. No changes were made.');
    logger.info('Run without --dry-run to apply changes.');
  }
};

// Run the script
main().catch(error => {
  console.error('Error running fat trimming script:', error);
  process.exit(1);
});
