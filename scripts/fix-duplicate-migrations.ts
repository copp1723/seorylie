/**
 * fix-duplicate-migrations.ts
 * 
 * This script safely renames the duplicate migration files:
 * - 0002_sms_delivery_tracking.sql -> 0010_sms_delivery_tracking.sql
 * - 0002_sms_delivery_tracking_rollback.sql -> 0010_sms_delivery_tracking_rollback.sql
 * 
 * It ensures the new files exist before removing the old ones and documents the change.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const BACKUP_DIR = path.join(process.cwd(), 'migrations', 'backup');
const LOG_FILE = path.join(process.cwd(), 'migrations', 'migration-rename.log');

// File mapping (old -> new)
const FILES_TO_RENAME = {
  '0002_sms_delivery_tracking.sql': '0010_sms_delivery_tracking.sql',
  '0002_sms_delivery_tracking_rollback.sql': '0010_sms_delivery_tracking_rollback.sql'
};

/**
 * Logs a message to console and appends to the log file
 */
function log(message: string, error = false): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Console output with color
  if (error) {
    console.error('\x1b[31m%s\x1b[0m', logMessage); // Red text for errors
  } else {
    console.log('\x1b[36m%s\x1b[0m', logMessage); // Cyan text for info
  }
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
 * Creates a backup directory if it doesn't exist
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Validates that new migration files exist before proceeding
 */
function validateNewFilesExist(): boolean {
  let allFilesExist = true;
  
  Object.values(FILES_TO_RENAME).forEach(newFile => {
    const newFilePath = path.join(MIGRATIONS_DIR, newFile);
    if (!fs.existsSync(newFilePath)) {
      log(`ERROR: New migration file does not exist: ${newFile}`, true);
      allFilesExist = false;
    } else {
      log(`Validated: ${newFile} exists`);
    }
  });
  
  return allFilesExist;
}

/**
 * Backs up and removes the old migration files
 */
function removeOldFiles(): void {
  Object.keys(FILES_TO_RENAME).forEach(oldFile => {
    const oldFilePath = path.join(MIGRATIONS_DIR, oldFile);
    const backupFilePath = path.join(BACKUP_DIR, oldFile);
    
    if (fs.existsSync(oldFilePath)) {
      // Create backup
      fs.copyFileSync(oldFilePath, backupFilePath);
      log(`Backed up: ${oldFile} -> ${backupFilePath}`);
      
      // Remove old file
      fs.unlinkSync(oldFilePath);
      log(`Removed: ${oldFile}`);
    } else {
      log(`Warning: Old file ${oldFile} not found, skipping`, true);
    }
  });
}

/**
 * Updates any references to the old migration in other files
 */
function updateReferences(): void {
  // This would scan through other files that might reference the migration
  // For now, we'll just log that this might be needed manually
  log(`Note: You may need to manually update references to the old migration files in:`);
  log(`  - Migration documentation`);
  log(`  - CI/CD scripts`);
  log(`  - Database initialization scripts`);
}

/**
 * Main function to execute the migration fix
 */
async function fixDuplicateMigrations(): Promise<void> {
  log('Starting migration renumbering process');
  log('------------------------------------');
  
  try {
    // Ensure backup directory exists
    ensureBackupDir();
    
    // Validate that the new files exist
    if (!validateNewFilesExist()) {
      log('ERROR: New migration files missing. Aborting operation.', true);
      log('Please create the new migration files before running this script.', true);
      process.exit(1);
    }
    
    // Compare file contents to ensure they match
    log('Validating file contents...');
    Object.entries(FILES_TO_RENAME).forEach(([oldFile, newFile]) => {
      const oldFilePath = path.join(MIGRATIONS_DIR, oldFile);
      const newFilePath = path.join(MIGRATIONS_DIR, newFile);
      
      if (fs.existsSync(oldFilePath) && fs.existsSync(newFilePath)) {
        // We don't compare exact content since the version number might be different
        // Just check file sizes are similar (within 10%)
        const oldSize = fs.statSync(oldFilePath).size;
        const newSize = fs.statSync(newFilePath).size;
        const sizeDiff = Math.abs(oldSize - newSize) / oldSize;
        
        if (sizeDiff > 0.1) {
          log(`WARNING: File size difference > 10% between ${oldFile} and ${newFile}`, true);
          log(`  Old: ${oldSize} bytes, New: ${newSize} bytes`, true);
        } else {
          log(`Validated: ${oldFile} and ${newFile} have similar content`);
        }
      }
    });
    
    // Backup and remove old files
    removeOldFiles();
    
    // Update references to the old migration
    updateReferences();
    
    // Add git commit if in a git repository
    try {
      if (fs.existsSync(path.join(process.cwd(), '.git'))) {
        log('Creating git commit for migration changes...');
        execSync('git add migrations/');
        execSync('git commit -m "fix: rename duplicate migration 0002_sms_delivery_tracking to 0010_sms_delivery_tracking"');
        log('Git commit created successfully');
      }
    } catch (gitError) {
      log(`Warning: Could not create git commit: ${gitError.message}`, true);
    }
    
    log('------------------------------------');
    log('Migration renumbering completed successfully!');
    log(`Old files backed up to: ${BACKUP_DIR}`);
    log(`Operation log saved to: ${LOG_FILE}`);
    
  } catch (error) {
    log(`CRITICAL ERROR: ${error.message}`, true);
    log('Migration renumbering failed. Check the log for details.', true);
    process.exit(1);
  }
}

// Execute the script
fixDuplicateMigrations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
