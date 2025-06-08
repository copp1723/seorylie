#!/usr/bin/env tsx
/**
 * Quick Cleanup Script
 *
 * A focused script that addresses immediate, low-risk cleanup issues:
 * - Removes duplicate config files
 * - Moves scattered documentation files to docs directory
 * - Cleans up obvious redundancies
 *
 * Usage:
 *   npx tsx scripts/quick-cleanup.ts [--dry-run] [--no-confirm]
 *
 * Options:
 *   --dry-run     Show what would be done without making changes
 *   --no-confirm  Skip confirmation prompts
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline";

// Configuration
const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const REPORTS_DIR = path.join(DOCS_DIR, "reports");
const TICKETS_DIR = path.join(DOCS_DIR, "tickets");

// Define patterns for cleanup
const REDUNDANT_CONFIG_FILES = [
  "jest.config.simple.js",
  "tsconfig.server.json",
  ".eslintrc.js",
];

const BACKUP_FILES = [
  "server/index.ts.bak",
  "server/observability/tracing.ts.backup",
];

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const NO_CONFIRM = args.includes("--no-confirm");

// Utility functions
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.log(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  success: (message: string) => console.log(`[SUCCESS] ${message}`),
};

const fileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

const getFileHash = (filePath: string): string => {
  try {
    return execSync(`git hash-object "${filePath}"`).toString().trim();
  } catch (error) {
    return "";
  }
};

const findFiles = (pattern: string, baseDir: string = ROOT_DIR): string[] => {
  try {
    const command = `find "${baseDir}" -type f -name "${pattern}" | grep -v "node_modules" | grep -v ".git"`;
    const output = execSync(command).toString().trim();

    return output
      ? output.split("\n").map((f) => path.relative(baseDir, f))
      : [];
  } catch (error) {
    return [];
  }
};

const askForConfirmation = async (message: string): Promise<boolean> => {
  if (NO_CONFIRM) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
};

const moveFile = (source: string, target: string): boolean => {
  const sourcePath = path.join(ROOT_DIR, source);
  const targetPath = path.join(ROOT_DIR, target);
  const targetDir = path.dirname(targetPath);

  if (!fileExists(sourcePath)) {
    logger.error(`Source file does not exist: ${source}`);
    return false;
  }

  if (!fileExists(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    logger.info(`Created directory: ${path.relative(ROOT_DIR, targetDir)}`);
  }

  if (fileExists(targetPath)) {
    // Compare file content
    const sourceHash = getFileHash(sourcePath);
    const targetHash = getFileHash(targetPath);

    if (sourceHash === targetHash) {
      logger.info(`Files are identical, removing source: ${source}`);
      fs.unlinkSync(sourcePath);
      return true;
    } else {
      logger.warn(`Target file exists with different content: ${target}`);
      return false;
    }
  }

  try {
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
    logger.success(`Moved: ${source} -> ${target}`);
    return true;
  } catch (error) {
    logger.error(`Failed to move file: ${source} -> ${target}`);
    console.error(error);
    return false;
  }
};

const removeFile = (filePath: string): boolean => {
  const fullPath = path.join(ROOT_DIR, filePath);

  if (!fileExists(fullPath)) {
    logger.error(`File does not exist: ${filePath}`);
    return false;
  }

  try {
    fs.unlinkSync(fullPath);
    logger.success(`Removed: ${filePath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to remove file: ${filePath}`);
    console.error(error);
    return false;
  }
};

// Cleanup functions
const findDuplicateDocFiles = (): Map<string, string[]> => {
  logger.info("Finding duplicate documentation files...");

  const fileHashes = new Map<string, string[]>();
  const mdFiles = findFiles("*.md");

  for (const file of mdFiles) {
    const filePath = path.join(ROOT_DIR, file);
    const hash = getFileHash(filePath);

    if (hash) {
      if (!fileHashes.has(hash)) {
        fileHashes.set(hash, []);
      }
      fileHashes.get(hash)?.push(file);
    }
  }

  // Filter to only include duplicates
  const duplicates = new Map<string, string[]>();
  for (const [hash, files] of fileHashes.entries()) {
    if (files.length > 1) {
      duplicates.set(hash, files);
    }
  }

  return duplicates;
};

const cleanupRedundantConfigs = async (): Promise<void> => {
  logger.info("Cleaning up redundant config files...");

  for (const configFile of REDUNDANT_CONFIG_FILES) {
    const filePath = path.join(ROOT_DIR, configFile);

    if (fileExists(filePath)) {
      logger.info(`Found redundant config file: ${configFile}`);

      if (DRY_RUN) {
        logger.info(`Would remove: ${configFile}`);
        continue;
      }

      if (
        await askForConfirmation(`Remove redundant config file: ${configFile}?`)
      ) {
        removeFile(configFile);
      }
    }
  }
};

const cleanupBackupFiles = async (): Promise<void> => {
  logger.info("Cleaning up backup files...");

  for (const backupFile of BACKUP_FILES) {
    const filePath = path.join(ROOT_DIR, backupFile);

    if (fileExists(filePath)) {
      logger.info(`Found backup file: ${backupFile}`);

      if (DRY_RUN) {
        logger.info(`Would remove: ${backupFile}`);
        continue;
      }

      if (await askForConfirmation(`Remove backup file: ${backupFile}?`)) {
        removeFile(backupFile);
      }
    }
  }

  // Find additional backup files
  const bakFiles = findFiles("*.bak");
  const backupFiles = findFiles("*.backup");

  for (const file of [...bakFiles, ...backupFiles]) {
    logger.info(`Found backup file: ${file}`);

    if (DRY_RUN) {
      logger.info(`Would remove: ${file}`);
      continue;
    }

    if (await askForConfirmation(`Remove backup file: ${file}?`)) {
      removeFile(file);
    }
  }
};

const organizeDocs = async (): Promise<void> => {
  logger.info("Organizing documentation files...");

  // Ensure docs directories exist
  if (!DRY_RUN) {
    if (!fileExists(DOCS_DIR)) {
      fs.mkdirSync(DOCS_DIR, { recursive: true });
    }
    if (!fileExists(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    if (!fileExists(TICKETS_DIR)) {
      fs.mkdirSync(TICKETS_DIR, { recursive: true });
    }
  }

  // Find markdown files in root
  const rootMdFiles = findFiles("*.md", ROOT_DIR).filter(
    (file) => !file.includes("/"),
  );

  logger.info(`Found ${rootMdFiles.length} markdown files in root directory`);

  // Skip README.md
  const filesToMove = rootMdFiles.filter((file) => file !== "README.md");

  for (const file of filesToMove) {
    let targetPath: string;

    // Determine target path based on file name pattern
    if (file.match(/TICKET_.*\.md$/)) {
      targetPath = path.join("docs/tickets", file);
    } else if (
      file.match(/.*_REPORT\.md$/) ||
      file.match(/.*-report\.md$/) ||
      file.match(/.*_SUMMARY\.md$/)
    ) {
      targetPath = path.join("docs/reports", file);
    } else {
      targetPath = path.join("docs", file);
    }

    logger.info(`Processing: ${file} -> ${targetPath}`);

    if (DRY_RUN) {
      logger.info(`Would move: ${file} -> ${targetPath}`);
      continue;
    }

    if (
      await askForConfirmation(
        `Move documentation file: ${file} -> ${targetPath}?`,
      )
    ) {
      moveFile(file, targetPath);
    }
  }

  // Handle duplicate documentation files
  const duplicates = findDuplicateDocFiles();
  logger.info(`Found ${duplicates.size} sets of duplicate documentation files`);

  for (const [hash, files] of duplicates.entries()) {
    logger.info(`\nDuplicate set (${hash}):`);
    files.forEach((file) => logger.info(`  - ${file}`));

    if (DRY_RUN) {
      logger.info("Would keep one file and remove duplicates");
      continue;
    }

    // Sort files to prioritize keeping files in docs directory
    const sortedFiles = [...files].sort((a, b) => {
      // Prefer files in docs directory
      const aInDocs = a.startsWith("docs/");
      const bInDocs = b.startsWith("docs/");

      if (aInDocs && !bInDocs) return -1;
      if (!aInDocs && bInDocs) return 1;

      // If both in docs or both not in docs, prefer shorter paths
      return a.length - b.length;
    });

    const fileToKeep = sortedFiles[0];
    const filesToRemove = sortedFiles.slice(1);

    logger.info(`Would keep: ${fileToKeep}`);

    for (const file of filesToRemove) {
      if (await askForConfirmation(`Remove duplicate file: ${file}?`)) {
        removeFile(file);
      }
    }
  }
};

const findUnusedJsFiles = async (): Promise<void> => {
  logger.info("Finding potentially unused JS files...");

  // Find JS files that have TS equivalents
  const jsFiles = findFiles("*.js");
  const tsFiles = findFiles("*.ts");

  const potentialDuplicates = jsFiles.filter((jsFile) => {
    const baseName = path.basename(jsFile, ".js");
    return tsFiles.some((tsFile) => path.basename(tsFile, ".ts") === baseName);
  });

  logger.info(
    `Found ${potentialDuplicates.length} JS files with TS equivalents`,
  );

  for (const file of potentialDuplicates) {
    logger.info(`Found potential JS/TS duplicate: ${file}`);

    if (DRY_RUN) {
      logger.info(`Would remove: ${file}`);
      continue;
    }

    if (
      await askForConfirmation(`Remove JS file with TS equivalent: ${file}?`)
    ) {
      removeFile(file);
    }
  }
};

// Main function
const main = async () => {
  logger.info(
    `Starting quick cleanup (dry-run: ${DRY_RUN}, no-confirm: ${NO_CONFIRM})`,
  );

  // Create a backup branch for safety
  if (!DRY_RUN) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupBranch = `backup/pre-cleanup-${timestamp}`;

    try {
      execSync(`git checkout -b ${backupBranch}`);
      logger.success(`Created backup branch: ${backupBranch}`);
      execSync("git checkout -");
    } catch (error) {
      logger.warn("Failed to create backup branch. Continuing anyway...");
    }
  }

  // Run cleanup tasks
  await cleanupRedundantConfigs();
  await cleanupBackupFiles();
  await organizeDocs();
  await findUnusedJsFiles();

  logger.success("Quick cleanup complete!");

  if (DRY_RUN) {
    logger.info("This was a dry run. No changes were made.");
    logger.info("Run without --dry-run to apply changes.");
  }
};

// Run the script
main().catch((error) => {
  console.error("Error running cleanup script:", error);
  process.exit(1);
});
