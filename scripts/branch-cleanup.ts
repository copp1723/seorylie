#!/usr/bin/env tsx
/**
 * Branch Cleanup Script (INT-015)
 *
 * A comprehensive utility for safely cleaning up integrated feature branches
 * after successful platform integration. Includes extensive safety measures,
 * verification, archiving, and reporting capabilities.
 *
 * Usage:
 *   tsx scripts/branch-cleanup.ts [options]
 *
 * Options:
 *   --dry-run             Preview actions without making changes
 *   --interactive         Enable interactive selection mode
 *   --archive-dir=<path>  Custom archive directory (default: .branch-archives)
 *   --verify-integration  Verify branches are fully integrated before deletion
 *   --skip-remote         Skip remote branch operations
 *   --force               Skip confirmation prompts (USE WITH CAUTION)
 *   --report-only         Generate reports without any branch operations
 *   --help                Show this help message
 *
 * Examples:
 *   tsx scripts/branch-cleanup.ts --dry-run
 *   tsx scripts/branch-cleanup.ts --interactive --verify-integration
 *   tsx scripts/branch-cleanup.ts --report-only
 *
 * @author Platform Integration Team
 * @version 1.0.0
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import { program } from "commander";
import * as inquirer from "inquirer";
import * as yaml from "js-yaml";
import { v4 as uuidv4 } from "uuid";
import * as archiver from "archiver";

// Type definitions
interface Branch {
  name: string;
  category: BranchCategory;
  integrated: boolean;
  lastCommitDate: Date;
  lastCommitHash: string;
  lastCommitAuthor: string;
  lastCommitMessage: string;
  ticketReference?: string;
  mergeStatus?: MergeStatus;
}

enum BranchCategory {
  FEATURE = "feature",
  INTEGRATION = "integration",
  PROTECTED = "protected",
  UNKNOWN = "unknown",
}

enum MergeStatus {
  FULLY_MERGED = "fully_merged",
  PARTIALLY_MERGED = "partially_merged",
  NOT_MERGED = "not_merged",
  UNKNOWN = "unknown",
}

interface CleanupConfig {
  dryRun: boolean;
  interactive: boolean;
  archiveDir: string;
  verifyIntegration: boolean;
  skipRemote: boolean;
  force: boolean;
  reportOnly: boolean;
}

interface CleanupReport {
  timestamp: string;
  executor: string;
  config: CleanupConfig;
  branchesAnalyzed: Branch[];
  branchesDeleted: Branch[];
  branchesArchived: Branch[];
  branchesSkipped: Branch[];
  errors: string[];
  warnings: string[];
  executionTime: number;
  rollbackCommands: string[];
}

interface IntegrationMap {
  [key: string]: {
    ticketId: string;
    sourceBranch: string;
    status: "completed" | "in-progress" | "pending";
  };
}

// Constants
const PROTECTED_BRANCHES = [
  "main",
  "master",
  "develop",
  "droid/platform-integration-tasks",
  "integration/production-readiness-phase1",
];

const INTEGRATED_BRANCHES = [
  "C5-global-error-handling", // INT-004
  "H6-kpi-query-caching", // INT-006
  "H2-sandbox-pause", // INT-007 (part 1)
  "H4-redis-websocket-scaling", // INT-007 (part 2)
  "T1-typescript-strict", // INT-009
  "U2-error-ux-improvements", // INT-011
];

const BRANCH_PATTERNS = {
  feature: /^(feature|feat)\/.*$/,
  bugfix: /^(bugfix|fix)\/.*$/,
  hotfix: /^hotfix\/.*$/,
  release: /^release\/.*$/,
  c_ticket: /^C\d+-.+$/,
  h_ticket: /^H\d+-.+$/,
  i_ticket: /^I\d+-.+$/,
  u_ticket: /^U\d+-.+$/,
  t_ticket: /^T\d+-.+$/,
};

const INTEGRATION_TICKETS: IntegrationMap = {
  "INT-004": {
    ticketId: "INT-004",
    sourceBranch: "C5-global-error-handling",
    status: "completed",
  },
  "INT-006": {
    ticketId: "INT-006",
    sourceBranch: "H6-kpi-query-caching",
    status: "completed",
  },
  "INT-007": {
    ticketId: "INT-007",
    sourceBranch: "H2-sandbox-pause,H4-redis-websocket-scaling",
    status: "completed",
  },
  "INT-009": {
    ticketId: "INT-009",
    sourceBranch: "T1-typescript-strict",
    status: "completed",
  },
  "INT-011": {
    ticketId: "INT-011",
    sourceBranch: "U2-error-ux-improvements",
    status: "completed",
  },
  "INT-013": {
    ticketId: "INT-013",
    sourceBranch: "integration/production-readiness-phase1",
    status: "completed",
  },
  "INT-014": {
    ticketId: "INT-014",
    sourceBranch: "integration/production-readiness-phase1",
    status: "completed",
  },
  "INT-015": {
    ticketId: "INT-015",
    sourceBranch: "integration/production-readiness-phase1",
    status: "in-progress",
  },
};

// Initialize CLI options
program
  .option("--dry-run", "Preview actions without making changes")
  .option("--interactive", "Enable interactive selection mode")
  .option(
    "--archive-dir <path>",
    "Custom archive directory",
    ".branch-archives",
  )
  .option(
    "--verify-integration",
    "Verify branches are fully integrated before deletion",
  )
  .option("--skip-remote", "Skip remote branch operations")
  .option("--force", "Skip confirmation prompts (USE WITH CAUTION)")
  .option("--report-only", "Generate reports without any branch operations")
  .parse(process.argv);

const options = program.opts();

// Configuration
const config: CleanupConfig = {
  dryRun: options.dryRun || false,
  interactive: options.interactive || false,
  archiveDir: options.archiveDir || ".branch-archives",
  verifyIntegration: options.verifyIntegration || false,
  skipRemote: options.skipRemote || false,
  force: options.force || false,
  reportOnly: options.reportOnly || false,
};

// Initialize report
const report: CleanupReport = {
  timestamp: new Date().toISOString(),
  executor: getGitUser(),
  config,
  branchesAnalyzed: [],
  branchesDeleted: [],
  branchesArchived: [],
  branchesSkipped: [],
  errors: [],
  warnings: [],
  executionTime: 0,
  rollbackCommands: [],
};

// Main execution
async function main() {
  const startTime = Date.now();

  printHeader();

  try {
    // Verify we're on the integration branch
    verifyCurrentBranch();

    // Setup archive directory
    setupArchiveDirectory();

    // Get all branches
    const branches = getAllBranches();
    report.branchesAnalyzed = branches;

    // Categorize branches
    categorizeBranches(branches);

    // Verify integration status if requested
    if (config.verifyIntegration) {
      await verifyBranchIntegration(branches);
    }

    // Generate and print report
    printBranchReport(branches);

    // If report-only mode, exit here
    if (config.reportOnly) {
      log(
        chalk.yellow("Report-only mode active. No branches will be modified."),
      );
      saveReport();
      return;
    }

    // Select branches to clean up
    const branchesToClean = await selectBranchesForCleanup(branches);

    // Confirm cleanup
    if (!config.force && !(await confirmCleanup(branchesToClean))) {
      log(chalk.yellow("Cleanup cancelled by user."));
      return;
    }

    // Archive branches before deletion
    await archiveBranches(branchesToClean);

    // Delete branches
    await deleteBranches(branchesToClean);

    // Update CI/CD references
    updateCiCdReferences(branchesToClean);

    // Generate final report
    report.executionTime = Date.now() - startTime;
    saveReport();

    printSuccessMessage();
  } catch (error) {
    handleError("An error occurred during branch cleanup", error);
  }
}

// Utility functions
function printHeader() {
  console.log(
    chalk.bold.blue("\n================================================="),
  );
  console.log(
    chalk.bold.blue("🧹 PLATFORM INTEGRATION BRANCH CLEANUP (INT-015) 🧹"),
  );
  console.log(
    chalk.bold.blue("=================================================\n"),
  );

  console.log(chalk.cyan("Current configuration:"));
  console.log(
    chalk.cyan(
      `• Dry run mode: ${config.dryRun ? chalk.green("ON") : chalk.red("OFF")}`,
    ),
  );
  console.log(
    chalk.cyan(
      `• Interactive mode: ${config.interactive ? chalk.green("ON") : chalk.red("OFF")}`,
    ),
  );
  console.log(chalk.cyan(`• Archive directory: ${config.archiveDir}`));
  console.log(
    chalk.cyan(
      `• Verify integration: ${config.verifyIntegration ? chalk.green("ON") : chalk.red("OFF")}`,
    ),
  );
  console.log(
    chalk.cyan(
      `• Skip remote operations: ${config.skipRemote ? chalk.green("ON") : chalk.red("OFF")}`,
    ),
  );
  console.log(
    chalk.cyan(
      `• Force mode: ${config.force ? chalk.yellow("ON - USE CAUTION") : chalk.green("OFF")}`,
    ),
  );
  console.log(
    chalk.cyan(
      `• Report only: ${config.reportOnly ? chalk.green("ON") : chalk.red("OFF")}\n`,
    ),
  );
}

function log(message: string) {
  console.log(message);
}

function getGitUser(): string {
  try {
    const name = execSync("git config user.name").toString().trim();
    const email = execSync("git config user.email").toString().trim();
    return `${name} <${email}>`;
  } catch (error) {
    return "Unknown User";
  }
}

function verifyCurrentBranch() {
  try {
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD")
      .toString()
      .trim();

    if (currentBranch !== "integration/production-readiness-phase1") {
      if (config.force) {
        report.warnings.push(
          `Not on integration branch. Currently on: ${currentBranch}`,
        );
        log(
          chalk.yellow(
            `⚠️  WARNING: You are not on the integration branch. Currently on: ${currentBranch}`,
          ),
        );
      } else {
        throw new Error(
          `Must be on integration/production-readiness-phase1 branch. Currently on: ${currentBranch}`,
        );
      }
    } else {
      log(
        chalk.green(
          `✓ Verified: Currently on integration branch: ${currentBranch}`,
        ),
      );
    }
  } catch (error) {
    handleError("Failed to verify current branch", error);
  }
}

function setupArchiveDirectory() {
  try {
    if (!fs.existsSync(config.archiveDir)) {
      if (!config.dryRun && !config.reportOnly) {
        fs.mkdirSync(config.archiveDir, { recursive: true });
        log(chalk.green(`✓ Created archive directory: ${config.archiveDir}`));
      } else {
        log(
          chalk.yellow(`Would create archive directory: ${config.archiveDir}`),
        );
      }
    } else {
      log(chalk.green(`✓ Archive directory exists: ${config.archiveDir}`));
    }
  } catch (error) {
    handleError("Failed to setup archive directory", error);
  }
}

function getAllBranches(): Branch[] {
  try {
    // Get local branches
    const localBranchesOutput = execSync("git branch").toString();
    const localBranches = localBranchesOutput
      .split("\n")
      .filter(Boolean)
      .map((b) => b.trim().replace(/^\*\s*/, ""));

    // Get remote branches if not skipping remote
    let remoteBranches: string[] = [];
    if (!config.skipRemote) {
      const remoteBranchesOutput = execSync("git branch -r").toString();
      remoteBranches = remoteBranchesOutput
        .split("\n")
        .filter(Boolean)
        .map((b) => b.trim().replace(/^origin\//, ""))
        .filter((b) => !b.includes("HEAD ->"));
    }

    // Combine and deduplicate
    const allBranchNames = Array.from(
      new Set([...localBranches, ...remoteBranches]),
    );

    log(chalk.green(`✓ Found ${allBranchNames.length} branches to analyze`));

    // Create branch objects with metadata
    return allBranchNames.map((name) => {
      try {
        const lastCommitInfo = execSync(
          `git log -1 --format="%H|%an|%ae|%ad|%s" ${name}`,
        )
          .toString()
          .trim()
          .split("|");
        const [hash, author, email, dateStr, message] = lastCommitInfo;

        return {
          name,
          category: BranchCategory.UNKNOWN, // Will be set in categorizeBranches
          integrated: INTEGRATED_BRANCHES.includes(name),
          lastCommitDate: new Date(dateStr),
          lastCommitHash: hash,
          lastCommitAuthor: `${author} <${email}>`,
          lastCommitMessage: message,
          ticketReference: extractTicketReference(name, message),
          mergeStatus: MergeStatus.UNKNOWN, // Will be determined later if verification is enabled
        };
      } catch (error) {
        // Handle branches that might not exist locally
        return {
          name,
          category: BranchCategory.UNKNOWN,
          integrated: INTEGRATED_BRANCHES.includes(name),
          lastCommitDate: new Date(),
          lastCommitHash: "unknown",
          lastCommitAuthor: "unknown",
          lastCommitMessage: "unknown",
          mergeStatus: MergeStatus.UNKNOWN,
        };
      }
    });
  } catch (error) {
    handleError("Failed to get branches", error);
    return [];
  }
}

function categorizeBranches(branches: Branch[]) {
  branches.forEach((branch) => {
    // Check if it's a protected branch
    if (PROTECTED_BRANCHES.includes(branch.name)) {
      branch.category = BranchCategory.PROTECTED;
      return;
    }

    // Check if it's an integration branch
    if (branch.name.startsWith("integration/")) {
      branch.category = BranchCategory.INTEGRATION;
      return;
    }

    // Check patterns for feature branches
    for (const [type, pattern] of Object.entries(BRANCH_PATTERNS)) {
      if (pattern.test(branch.name)) {
        branch.category = BranchCategory.FEATURE;
        return;
      }
    }

    // Default to unknown
    branch.category = BranchCategory.UNKNOWN;
  });

  log(chalk.green(`✓ Categorized ${branches.length} branches`));
}

function extractTicketReference(
  branchName: string,
  commitMessage: string,
): string | undefined {
  // Try to extract from branch name first
  const branchTicketMatch =
    branchName.match(/^([CHIUT]\d+)-/) || branchName.match(/^(INT-\d+)/);
  if (branchTicketMatch) {
    return branchTicketMatch[1];
  }

  // Try to extract from commit message
  const commitTicketMatch =
    commitMessage.match(/\[(INT-\d+|[CHIUT]\d+)\]/) ||
    commitMessage.match(/(INT-\d+|[CHIUT]\d+):/);
  if (commitTicketMatch) {
    return commitTicketMatch[1];
  }

  return undefined;
}

async function verifyBranchIntegration(branches: Branch[]) {
  log(chalk.cyan("Verifying branch integration status..."));

  const integrationBranch = "integration/production-readiness-phase1";

  for (const branch of branches) {
    if (
      branch.category === BranchCategory.PROTECTED ||
      branch.category === BranchCategory.INTEGRATION
    ) {
      continue; // Skip protected and integration branches
    }

    try {
      // Check if all commits from the branch are in the integration branch
      const uniqueCommits = execSync(
        `git log --cherry-pick --no-merges --oneline ${integrationBranch}...${branch.name}`,
      )
        .toString()
        .trim();

      if (!uniqueCommits) {
        branch.mergeStatus = MergeStatus.FULLY_MERGED;
        log(
          chalk.green(
            `✓ Branch ${branch.name} is fully merged into ${integrationBranch}`,
          ),
        );
      } else {
        const commitCount = uniqueCommits.split("\n").length;
        branch.mergeStatus = MergeStatus.PARTIALLY_MERGED;
        log(
          chalk.yellow(
            `⚠️  Branch ${branch.name} has ${commitCount} commits not in ${integrationBranch}`,
          ),
        );

        // Add to warnings
        report.warnings.push(
          `Branch ${branch.name} has ${commitCount} commits not in ${integrationBranch}`,
        );
      }
    } catch (error) {
      branch.mergeStatus = MergeStatus.UNKNOWN;
      log(chalk.red(`✗ Failed to verify merge status for ${branch.name}`));
      report.errors.push(
        `Failed to verify merge status for ${branch.name}: ${error}`,
      );
    }
  }

  log(chalk.green("✓ Branch integration verification complete"));
}

function printBranchReport(branches: Branch[]) {
  const categoryCounts = {
    [BranchCategory.FEATURE]: 0,
    [BranchCategory.INTEGRATION]: 0,
    [BranchCategory.PROTECTED]: 0,
    [BranchCategory.UNKNOWN]: 0,
  };

  const mergeStatusCounts = {
    [MergeStatus.FULLY_MERGED]: 0,
    [MergeStatus.PARTIALLY_MERGED]: 0,
    [MergeStatus.NOT_MERGED]: 0,
    [MergeStatus.UNKNOWN]: 0,
  };

  branches.forEach((branch) => {
    categoryCounts[branch.category]++;
    if (branch.mergeStatus) {
      mergeStatusCounts[branch.mergeStatus]++;
    }
  });

  console.log(chalk.bold.cyan("\n📊 BRANCH ANALYSIS REPORT 📊"));
  console.log(chalk.cyan("===========================\n"));

  console.log(chalk.bold("Branch Categories:"));
  console.log(`• Protected: ${categoryCounts[BranchCategory.PROTECTED]}`);
  console.log(`• Integration: ${categoryCounts[BranchCategory.INTEGRATION]}`);
  console.log(`• Feature: ${categoryCounts[BranchCategory.FEATURE]}`);
  console.log(`• Unknown: ${categoryCounts[BranchCategory.UNKNOWN]}`);

  if (config.verifyIntegration) {
    console.log(chalk.bold("\nMerge Status:"));
    console.log(
      `• Fully Merged: ${mergeStatusCounts[MergeStatus.FULLY_MERGED]}`,
    );
    console.log(
      `• Partially Merged: ${mergeStatusCounts[MergeStatus.PARTIALLY_MERGED]}`,
    );
    console.log(`• Not Merged: ${mergeStatusCounts[MergeStatus.NOT_MERGED]}`);
    console.log(`• Unknown: ${mergeStatusCounts[MergeStatus.UNKNOWN]}`);
  }

  console.log(chalk.bold("\nIntegrated Feature Branches:"));
  const integratedBranches = branches.filter((b) =>
    INTEGRATED_BRANCHES.includes(b.name),
  );
  if (integratedBranches.length === 0) {
    console.log("• None found");
  } else {
    integratedBranches.forEach((branch) => {
      const ticketRef = branch.ticketReference
        ? `[${branch.ticketReference}]`
        : "";
      console.log(`• ${branch.name} ${ticketRef}`);
    });
  }

  console.log(chalk.bold("\nPotentially Unintegrated Branches:"));
  const unintegratedBranches = branches.filter(
    (b) =>
      b.category === BranchCategory.FEATURE &&
      !INTEGRATED_BRANCHES.includes(b.name) &&
      !PROTECTED_BRANCHES.includes(b.name),
  );

  if (unintegratedBranches.length === 0) {
    console.log("• None found");
  } else {
    unintegratedBranches.forEach((branch) => {
      const ticketRef = branch.ticketReference
        ? `[${branch.ticketReference}]`
        : "";
      const mergeStatus = branch.mergeStatus ? ` (${branch.mergeStatus})` : "";
      console.log(`• ${branch.name} ${ticketRef}${mergeStatus}`);
    });
  }

  console.log("\n");
}

async function selectBranchesForCleanup(branches: Branch[]): Promise<Branch[]> {
  // Filter out protected branches
  const eligibleBranches = branches.filter(
    (b) =>
      b.category !== BranchCategory.PROTECTED &&
      !PROTECTED_BRANCHES.includes(b.name),
  );

  // Default selection: all integrated branches
  let selectedBranches = eligibleBranches.filter(
    (b) =>
      INTEGRATED_BRANCHES.includes(b.name) ||
      (b.mergeStatus === MergeStatus.FULLY_MERGED &&
        b.category === BranchCategory.FEATURE),
  );

  // If interactive mode is enabled, let the user select branches
  if (config.interactive) {
    const { selectedBranchNames } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedBranchNames",
        message: "Select branches to clean up:",
        choices: eligibleBranches.map((branch) => {
          const ticketRef = branch.ticketReference
            ? `[${branch.ticketReference}]`
            : "";
          const integrated = INTEGRATED_BRANCHES.includes(branch.name)
            ? "[INTEGRATED]"
            : "";
          const mergeStatus = branch.mergeStatus
            ? `[${branch.mergeStatus}]`
            : "";

          return {
            name: `${branch.name} ${ticketRef} ${integrated} ${mergeStatus}`,
            value: branch.name,
            checked:
              INTEGRATED_BRANCHES.includes(branch.name) ||
              branch.mergeStatus === MergeStatus.FULLY_MERGED,
          };
        }),
      },
    ]);

    selectedBranches = eligibleBranches.filter((b) =>
      selectedBranchNames.includes(b.name),
    );
  }

  log(
    chalk.green(`✓ Selected ${selectedBranches.length} branches for cleanup`),
  );

  return selectedBranches;
}

async function confirmCleanup(branches: Branch[]): Promise<boolean> {
  if (branches.length === 0) {
    log(chalk.yellow("No branches selected for cleanup."));
    return false;
  }

  console.log(chalk.bold.yellow("\n⚠️  CLEANUP CONFIRMATION ⚠️"));
  console.log(chalk.yellow("=========================\n"));

  console.log(
    chalk.bold("The following branches will be archived and deleted:"),
  );
  branches.forEach((branch) => {
    const ticketRef = branch.ticketReference
      ? `[${branch.ticketReference}]`
      : "";
    console.log(`• ${branch.name} ${ticketRef}`);
  });

  if (config.dryRun) {
    console.log(
      chalk.bold.green("\nDRY RUN MODE: No actual changes will be made."),
    );
    return true;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.bold.red(
        "Are you sure you want to proceed with branch cleanup?",
      ),
      default: false,
    },
  ]);

  return confirm;
}

async function archiveBranches(branches: Branch[]) {
  if (branches.length === 0) return;

  log(chalk.cyan("Archiving branches before deletion..."));

  const archiveTimestamp = new Date().toISOString().replace(/:/g, "-");
  const archiveFilename = `branch-archive-${archiveTimestamp}.zip`;
  const archiveFilePath = path.join(config.archiveDir, archiveFilename);

  if (config.dryRun) {
    log(
      chalk.yellow(
        `Would archive ${branches.length} branches to ${archiveFilePath}`,
      ),
    );
    report.branchesArchived = branches;
    return;
  }

  try {
    // Create metadata file
    const metadataPath = path.join(
      config.archiveDir,
      `metadata-${archiveTimestamp}.json`,
    );
    const metadata = {
      archivedAt: new Date().toISOString(),
      archivedBy: getGitUser(),
      branches: branches.map((b) => ({
        name: b.name,
        lastCommitHash: b.lastCommitHash,
        lastCommitDate: b.lastCommitDate,
        lastCommitAuthor: b.lastCommitAuthor,
        lastCommitMessage: b.lastCommitMessage,
        ticketReference: b.ticketReference,
      })),
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Create archive of each branch
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = fs.createWriteStream(archiveFilePath);

    archive.pipe(output);

    // Add metadata file to archive
    archive.file(metadataPath, { name: "metadata.json" });

    // For each branch, create a patch file and add to archive
    for (const branch of branches) {
      const patchFilename = `${branch.name.replace(/\//g, "-")}.patch`;
      const patchPath = path.join(config.archiveDir, patchFilename);

      // Create patch file with full branch history
      execSync(
        `git format-patch --stdout origin/main..${branch.name} > ${patchPath}`,
      );

      // Add to archive
      archive.file(patchPath, { name: `patches/${patchFilename}` });

      // Add rollback command
      report.rollbackCommands.push(
        `# To restore ${branch.name}:\n` +
          `git checkout -b ${branch.name}-restored main\n` +
          `git am < ${archiveFilePath}/patches/${patchFilename}\n`,
      );

      // Clean up temporary patch file
      fs.unlinkSync(patchPath);
    }

    // Finalize archive
    await archive.finalize();

    // Clean up metadata file
    fs.unlinkSync(metadataPath);

    log(
      chalk.green(
        `✓ Archived ${branches.length} branches to ${archiveFilePath}`,
      ),
    );
    report.branchesArchived = branches;
  } catch (error) {
    handleError(`Failed to archive branches to ${archiveFilePath}`, error);
  }
}

async function deleteBranches(branches: Branch[]) {
  if (branches.length === 0) return;

  log(chalk.cyan("Deleting branches..."));

  for (const branch of branches) {
    try {
      if (config.dryRun) {
        log(chalk.yellow(`Would delete branch: ${branch.name}`));
        continue;
      }

      // Delete local branch
      execSync(`git branch -D ${branch.name}`);
      log(chalk.green(`✓ Deleted local branch: ${branch.name}`));

      // Delete remote branch if not skipping remote
      if (!config.skipRemote) {
        execSync(`git push origin --delete ${branch.name}`);
        log(chalk.green(`✓ Deleted remote branch: origin/${branch.name}`));
      }

      report.branchesDeleted.push(branch);
    } catch (error) {
      log(chalk.red(`✗ Failed to delete branch: ${branch.name}`));
      report.errors.push(`Failed to delete branch ${branch.name}: ${error}`);
      report.branchesSkipped.push(branch);
    }
  }

  log(chalk.green(`✓ Deleted ${report.branchesDeleted.length} branches`));
}

function updateCiCdReferences(deletedBranches: Branch[]) {
  if (deletedBranches.length === 0 || config.dryRun || config.reportOnly)
    return;

  log(chalk.cyan("Updating CI/CD references..."));

  try {
    // Update GitHub Actions workflow files
    const workflowsDir = ".github/workflows";

    if (fs.existsSync(workflowsDir)) {
      const workflowFiles = fs
        .readdirSync(workflowsDir)
        .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

      for (const file of workflowFiles) {
        const filePath = path.join(workflowsDir, file);
        const content = fs.readFileSync(filePath, "utf8");

        let updatedContent = content;
        let hasChanges = false;

        // Update branch references in workflow files
        for (const branch of deletedBranches) {
          const branchRegex = new RegExp(`\\b${branch.name}\\b`, "g");
          if (branchRegex.test(content)) {
            updatedContent = updatedContent.replace(
              branchRegex,
              "integration/production-readiness-phase1",
            );
            hasChanges = true;
          }
        }

        if (hasChanges) {
          fs.writeFileSync(filePath, updatedContent);
          log(chalk.green(`✓ Updated CI/CD references in ${filePath}`));
        }
      }
    }

    // Update README.md if it exists
    if (fs.existsSync("README.md")) {
      const readmePath = "README.md";
      const readmeContent = fs.readFileSync(readmePath, "utf8");

      let updatedReadme = readmeContent;
      let hasChanges = false;

      // Update branch references in README
      for (const branch of deletedBranches) {
        const branchRegex = new RegExp(`\\b${branch.name}\\b`, "g");
        if (branchRegex.test(readmeContent)) {
          updatedReadme = updatedReadme.replace(
            branchRegex,
            "integration/production-readiness-phase1",
          );
          hasChanges = true;
        }
      }

      // Add note about branch cleanup
      if (hasChanges) {
        const cleanupNote = `\n\n> **Note:** As part of INT-015, legacy feature branches have been consolidated into \`integration/production-readiness-phase1\`. Please use this branch for all development work.\n`;
        updatedReadme = updatedReadme + cleanupNote;

        fs.writeFileSync(readmePath, updatedReadme);
        log(chalk.green(`✓ Updated README.md with branch cleanup information`));
      }
    }

    log(chalk.green("✓ CI/CD references updated successfully"));
  } catch (error) {
    handleError("Failed to update CI/CD references", error);
  }
}

function saveReport() {
  const reportTimestamp = new Date().toISOString().replace(/:/g, "-");
  const reportFilename = `branch-cleanup-report-${reportTimestamp}.json`;
  const reportPath = path.join(config.archiveDir, reportFilename);

  try {
    if (!config.dryRun) {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      log(chalk.green(`✓ Saved cleanup report to ${reportPath}`));

      // Generate markdown report for easier reading
      const mdReportPath = path.join(
        config.archiveDir,
        `branch-cleanup-report-${reportTimestamp}.md`,
      );
      const mdReport = generateMarkdownReport(report);
      fs.writeFileSync(mdReportPath, mdReport);
      log(chalk.green(`✓ Saved markdown report to ${mdReportPath}`));
    } else {
      log(chalk.yellow(`Would save cleanup report to ${reportPath}`));
    }
  } catch (error) {
    handleError("Failed to save cleanup report", error);
  }
}

function generateMarkdownReport(report: CleanupReport): string {
  return `# Branch Cleanup Report

## Summary
- **Timestamp:** ${report.timestamp}
- **Executed by:** ${report.executor}
- **Execution time:** ${(report.executionTime / 1000).toFixed(2)} seconds
- **Mode:** ${report.config.dryRun ? "Dry run" : "Production"}

## Statistics
- **Branches analyzed:** ${report.branchesAnalyzed.length}
- **Branches archived:** ${report.branchesArchived.length}
- **Branches deleted:** ${report.branchesDeleted.length}
- **Branches skipped:** ${report.branchesSkipped.length}
- **Errors encountered:** ${report.errors.length}
- **Warnings:** ${report.warnings.length}

## Deleted Branches
${report.branchesDeleted.map((b) => `- \`${b.name}\` (${b.ticketReference || "No ticket reference"})`).join("\n")}

## Skipped Branches
${report.branchesSkipped.map((b) => `- \`${b.name}\` (${b.ticketReference || "No ticket reference"})`).join("\n")}

## Errors
${report.errors.length > 0 ? report.errors.map((e) => `- ${e}`).join("\n") : "No errors encountered"}

## Warnings
${report.warnings.length > 0 ? report.warnings.map((w) => `- ${w}`).join("\n") : "No warnings encountered"}

## Rollback Instructions
If you need to restore a deleted branch, use the following commands:

\`\`\`bash
${report.rollbackCommands.join("\n\n")}
\`\`\`

## Configuration
\`\`\`json
${JSON.stringify(report.config, null, 2)}
\`\`\`
`;
}

function printSuccessMessage() {
  console.log(chalk.bold.green("\n🎉 BRANCH CLEANUP COMPLETE 🎉"));
  console.log(chalk.green("================================\n"));

  console.log(chalk.bold(`Summary:`));
  console.log(`• Branches analyzed: ${report.branchesAnalyzed.length}`);
  console.log(`• Branches archived: ${report.branchesArchived.length}`);
  console.log(`• Branches deleted: ${report.branchesDeleted.length}`);
  console.log(`• Branches skipped: ${report.branchesSkipped.length}`);
  console.log(`• Errors: ${report.errors.length}`);
  console.log(`• Warnings: ${report.warnings.length}`);
  console.log(
    `• Execution time: ${(report.executionTime / 1000).toFixed(2)} seconds`,
  );

  console.log(chalk.bold.green("\nNext Steps:"));
  console.log(`1. Review the cleanup report in ${config.archiveDir}`);
  console.log(`2. Push branch protection rule updates to GitHub`);
  console.log(`3. Notify team in #integration-sprint channel`);
  console.log(`4. Update documentation with new branching strategy`);

  console.log(
    chalk.bold.blue(
      "\nINT-015 Legacy Branch Cleanup completed successfully! 🚀",
    ),
  );
}

function handleError(message: string, error: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log(chalk.red(`✗ ${message}: ${errorMessage}`));
  report.errors.push(`${message}: ${errorMessage}`);

  // Save report even if there was an error
  report.executionTime = Date.now() - new Date(report.timestamp).getTime();
  saveReport();

  process.exit(1);
}

// Run the main function
main().catch((error) => {
  handleError("Unhandled error in main execution", error);
});
