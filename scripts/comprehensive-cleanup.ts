#!/usr/bin/env tsx
/**
 * Comprehensive Cleanup Script
 *
 * A thorough script that organizes all loose files in the repository root:
 * - Moves test scripts to test/scripts/
 * - Moves JSON reports to docs/reports/
 * - Moves example/demo files to examples/
 * - Organizes utility scripts to scripts/utils/
 * - Keeps only essential files in root
 *
 * Usage:
 *   npx tsx scripts/comprehensive-cleanup.ts [--dry-run] [--no-confirm]
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
const TEST_SCRIPTS_DIR = path.join(ROOT_DIR, "test", "scripts");
const EXAMPLES_DIR = path.join(ROOT_DIR, "examples");
const SCRIPTS_UTILS_DIR = path.join(ROOT_DIR, "scripts", "utils");

// Files that should stay in root
const ROOT_ESSENTIAL_FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "README.md",
  ".env.example",
  ".gitignore",
  "Dockerfile",
  "docker-compose.yml",
  "postcss.config.js",
  "tailwind.config.js",
  "jest.config.js",
  "vite.config.ts",
  ".eslintrc.js",
  ".prettierrc",
  "components.json",
];

// File patterns for organizing
const FILE_PATTERNS = {
  // Test scripts
  testScripts: [
    /test.*\.js$/,
    /.*-test\.js$/,
    /e2e.*\.js$/,
    /.*-journey.*\.js$/,
    /run-.*-tests\.js$/,
    /verify-.*\.js$/,
    /context-switching-test\.js/,
  ],

  // JSON reports
  jsonReports: [
    /.*-report\.json$/,
    /.*-analysis.*\.json$/,
    /inventory-analysis-report\.json/,
  ],

  // Example/demo files
  exampleFiles: [/demo.*\.js$/, /example.*\.js$/, /ai-system-demo\.js/],

  // Utility scripts
  utilityScripts: [
    /fix-.*\.js$/,
    /check-.*\.js$/,
    /simple-.*\.js$/,
    /debug-.*\.js$/,
  ],
};

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
  section: (message: string) =>
    console.log(`\n[SECTION] ${message}\n${"-".repeat(message.length + 11)}`),
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

const findFiles = (
  pattern: string | RegExp,
  baseDir: string = ROOT_DIR,
): string[] => {
  try {
    if (typeof pattern === "string") {
      const command = `find "${baseDir}" -type f -name "${pattern}" | grep -v "node_modules" | grep -v ".git"`;
      const output = execSync(command).toString().trim();

      return output
        ? output.split("\n").map((f) => path.relative(baseDir, f))
        : [];
    } else {
      // For RegExp patterns, get all files and filter
      const command = `find "${baseDir}" -type f | grep -v "node_modules" | grep -v ".git"`;
      const output = execSync(command).toString().trim();
      const allFiles = output
        ? output.split("\n").map((f) => path.relative(baseDir, f))
        : [];

      // Filter files that match the pattern and are in the root directory
      return allFiles.filter(
        (file) => !file.includes("/") && pattern.test(file),
      );
    }
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
const organizeTestScripts = async (): Promise<void> => {
  logger.section("Organizing Test Scripts");

  // Ensure test scripts directory exists
  if (!DRY_RUN && !fileExists(TEST_SCRIPTS_DIR)) {
    fs.mkdirSync(TEST_SCRIPTS_DIR, { recursive: true });
    logger.info(`Created directory: test/scripts`);
  }

  // Find test scripts in root
  let testScripts: string[] = [];

  // Use each pattern to find matching files
  for (const pattern of FILE_PATTERNS.testScripts) {
    const matchingFiles = findFiles(pattern);
    testScripts = [...testScripts, ...matchingFiles];
  }

  // Remove duplicates
  testScripts = [...new Set(testScripts)];

  logger.info(`Found ${testScripts.length} test scripts in root directory`);

  for (const file of testScripts) {
    const targetPath = path.join("test/scripts", file);

    logger.info(`Processing: ${file} -> ${targetPath}`);

    if (DRY_RUN) {
      logger.info(`Would move: ${file} -> ${targetPath}`);
      continue;
    }

    if (
      await askForConfirmation(`Move test script: ${file} -> ${targetPath}?`)
    ) {
      moveFile(file, targetPath);
    }
  }
};

const organizeJsonReports = async (): Promise<void> => {
  logger.section("Organizing JSON Reports");

  // Ensure reports directory exists
  if (!DRY_RUN) {
    if (!fileExists(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      logger.info(`Created directory: docs/reports`);
    }
  }

  // Find JSON reports in root
  let jsonReports: string[] = [];

  // Use each pattern to find matching files
  for (const pattern of FILE_PATTERNS.jsonReports) {
    const matchingFiles = findFiles(pattern);
    jsonReports = [...jsonReports, ...matchingFiles];
  }

  // Remove duplicates
  jsonReports = [...new Set(jsonReports)];

  logger.info(`Found ${jsonReports.length} JSON reports in root directory`);

  for (const file of jsonReports) {
    const targetPath = path.join("docs/reports", file);

    logger.info(`Processing: ${file} -> ${targetPath}`);

    if (DRY_RUN) {
      logger.info(`Would move: ${file} -> ${targetPath}`);
      continue;
    }

    if (
      await askForConfirmation(`Move JSON report: ${file} -> ${targetPath}?`)
    ) {
      moveFile(file, targetPath);
    }
  }
};

const organizeExampleFiles = async (): Promise<void> => {
  logger.section("Organizing Example/Demo Files");

  // Ensure examples directory exists
  if (!DRY_RUN && !fileExists(EXAMPLES_DIR)) {
    fs.mkdirSync(EXAMPLES_DIR, { recursive: true });
    logger.info(`Created directory: examples`);
  }

  // Find example/demo files in root
  let exampleFiles: string[] = [];

  // Use each pattern to find matching files
  for (const pattern of FILE_PATTERNS.exampleFiles) {
    const matchingFiles = findFiles(pattern);
    exampleFiles = [...exampleFiles, ...matchingFiles];
  }

  // Remove duplicates
  exampleFiles = [...new Set(exampleFiles)];

  logger.info(
    `Found ${exampleFiles.length} example/demo files in root directory`,
  );

  for (const file of exampleFiles) {
    const targetPath = path.join("examples", file);

    logger.info(`Processing: ${file} -> ${targetPath}`);

    if (DRY_RUN) {
      logger.info(`Would move: ${file} -> ${targetPath}`);
      continue;
    }

    if (
      await askForConfirmation(`Move example file: ${file} -> ${targetPath}?`)
    ) {
      moveFile(file, targetPath);
    }
  }
};

const organizeUtilityScripts = async (): Promise<void> => {
  logger.section("Organizing Utility Scripts");

  // Ensure utility scripts directory exists
  if (!DRY_RUN && !fileExists(SCRIPTS_UTILS_DIR)) {
    fs.mkdirSync(SCRIPTS_UTILS_DIR, { recursive: true });
    logger.info(`Created directory: scripts/utils`);
  }

  // Find utility scripts in root
  let utilityScripts: string[] = [];

  // Use each pattern to find matching files
  for (const pattern of FILE_PATTERNS.utilityScripts) {
    const matchingFiles = findFiles(pattern);
    utilityScripts = [...utilityScripts, ...matchingFiles];
  }

  // Remove duplicates
  utilityScripts = [...new Set(utilityScripts)];

  logger.info(
    `Found ${utilityScripts.length} utility scripts in root directory`,
  );

  for (const file of utilityScripts) {
    const targetPath = path.join("scripts/utils", file);

    logger.info(`Processing: ${file} -> ${targetPath}`);

    if (DRY_RUN) {
      logger.info(`Would move: ${file} -> ${targetPath}`);
      continue;
    }

    if (
      await askForConfirmation(`Move utility script: ${file} -> ${targetPath}?`)
    ) {
      moveFile(file, targetPath);
    }
  }
};

const organizeRemainingFiles = async (): Promise<void> => {
  logger.section("Organizing Remaining Files");

  // Get all files in root
  const command = `find "${ROOT_DIR}" -maxdepth 1 -type f | grep -v "node_modules" | grep -v ".git"`;
  const output = execSync(command).toString().trim();
  const allRootFiles = output
    ? output.split("\n").map((f) => path.basename(f))
    : [];

  // Filter out essential files and already processed files
  const essentialSet = new Set(ROOT_ESSENTIAL_FILES);
  const remainingFiles = allRootFiles.filter((file) => {
    // Keep essential files in root
    if (essentialSet.has(file)) return false;

    // Skip files without extensions
    const ext = path.extname(file);
    if (!ext) return false;

    // Skip dot files
    if (file.startsWith(".")) return false;

    // Skip our cleanup scripts
    if (file.includes("cleanup") && ext === ".ts") return false;

    return true;
  });

  logger.info(`Found ${remainingFiles.length} remaining files to organize`);

  for (const file of remainingFiles) {
    let targetPath: string;

    // Determine target path based on file extension
    const ext = path.extname(file);

    if (ext === ".js" || ext === ".ts") {
      targetPath = path.join("scripts/utils", file);
    } else if (ext === ".json") {
      targetPath = path.join("docs/reports", file);
    } else if (ext === ".txt" || ext === ".log") {
      targetPath = path.join("docs/logs", file);
    } else if (ext === ".md") {
      targetPath = path.join("docs", file);
    } else {
      targetPath = path.join("misc", file);
    }

    logger.info(`Processing: ${file} -> ${targetPath}`);

    if (DRY_RUN) {
      logger.info(`Would move: ${file} -> ${targetPath}`);
      continue;
    }

    if (await askForConfirmation(`Move file: ${file} -> ${targetPath}?`)) {
      moveFile(file, targetPath);
    }
  }
};

const analyzeRootDirectory = (): void => {
  logger.section("Root Directory Analysis");

  // Get all files in root
  const command = `find "${ROOT_DIR}" -maxdepth 1 -type f | grep -v "node_modules" | grep -v ".git"`;
  const output = execSync(command).toString().trim();
  const allRootFiles = output
    ? output.split("\n").map((f) => path.basename(f))
    : [];

  // Count by extension
  const extensionCounts: Record<string, number> = {};

  for (const file of allRootFiles) {
    const ext = path.extname(file) || "no-extension";
    extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
  }

  // Log analysis
  logger.info(`Root directory contains ${allRootFiles.length} files:`);

  for (const [ext, count] of Object.entries(extensionCounts)) {
    logger.info(`  - ${ext}: ${count} files`);
  }

  // Essential files check
  const essentialSet = new Set(ROOT_ESSENTIAL_FILES);
  const missingEssential = ROOT_ESSENTIAL_FILES.filter(
    (file) => !allRootFiles.includes(file),
  );
  const nonEssential = allRootFiles.filter((file) => !essentialSet.has(file));

  if (missingEssential.length > 0) {
    logger.warn(`Missing essential files: ${missingEssential.join(", ")}`);
  }

  if (nonEssential.length > 0) {
    logger.info(`${nonEssential.length} non-essential files can be organized`);
  }
};

// Main function
const main = async () => {
  logger.info(
    `Starting comprehensive cleanup (dry-run: ${DRY_RUN}, no-confirm: ${NO_CONFIRM})`,
  );

  // Analyze root directory
  analyzeRootDirectory();

  // Create a backup branch for safety
  if (!DRY_RUN) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupBranch = `backup/comprehensive-cleanup-${timestamp}`;

    try {
      execSync(`git checkout -b ${backupBranch}`);
      logger.success(`Created backup branch: ${backupBranch}`);
      execSync("git checkout -");
    } catch (error) {
      logger.warn("Failed to create backup branch. Continuing anyway...");
    }
  }

  // Run cleanup tasks
  await organizeTestScripts();
  await organizeJsonReports();
  await organizeExampleFiles();
  await organizeUtilityScripts();
  await organizeRemainingFiles();

  logger.success("Comprehensive cleanup complete!");

  if (DRY_RUN) {
    logger.info("This was a dry run. No changes were made.");
    logger.info("Run without --dry-run to apply changes.");
  } else {
    // Final analysis
    analyzeRootDirectory();
  }
};

// Run the script
main().catch((error) => {
  console.error("Error running cleanup script:", error);
  process.exit(1);
});
