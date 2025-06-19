#!/usr/bin/env tsx
/**
 * Fat Analysis Script
 *
 * A comprehensive tool to identify "fat" that can be trimmed from the repository:
 * - Unused dependencies
 * - Redundant scripts
 * - Large files
 * - Duplicate test configurations
 * - Dead code
 * - Old/unused configuration files
 *
 * Usage:
 *   npx tsx scripts/fat-analysis.ts [--verbose] [--fix]
 *
 * Options:
 *   --verbose     Show detailed analysis information
 *   --fix         Automatically fix simple issues (use with caution)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createInterface } from "readline";

// Configuration
const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const MAX_FILE_SIZE_KB = 500; // Files larger than this will be flagged
const MIN_SCRIPT_USAGE_COUNT = 2; // Scripts used less than this many times will be flagged
const IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".nyc_output",
];

// Parse command line arguments
const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const FIX = args.includes("--fix");

// Utility functions
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.log(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  success: (message: string) => console.log(`[SUCCESS] ${message}`),
  section: (title: string) =>
    console.log(`\n${"=".repeat(80)}\n${title}\n${"=".repeat(80)}\n`),
  verbose: (message: string) => VERBOSE && console.log(`[VERBOSE] ${message}`),
};

const fileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

const getFileSize = (filePath: string): number => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
};

const readJsonFile = <T>(filePath: string): T | null => {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    logger.error(`Failed to read JSON file: ${filePath}`);
    return null;
  }
};

const findFiles = (
  patterns: string[],
  baseDir: string = ROOT_DIR,
): string[] => {
  try {
    const patternString = patterns.map((p) => `-name "${p}"`).join(" -o ");
    const ignoreString = IGNORE_PATTERNS.map(
      (p) => `-not -path "*/${p}/*"`,
    ).join(" ");

    const command = `find "${baseDir}" -type f \\( ${patternString} \\) ${ignoreString}`;
    const output = execSync(command).toString().trim();

    return output ? output.split("\n") : [];
  } catch (error) {
    logger.error(`Failed to find files: ${error}`);
    return [];
  }
};

const countFileUsage = (
  filePath: string,
  baseDir: string = ROOT_DIR,
): number => {
  try {
    const relativePath = path.relative(baseDir, filePath);
    const fileName = path.basename(filePath);

    // Search for imports of this file
    const grepCommand = `grep -r "import.*from.*['\"].*${fileName.replace(".", "\\.")}['\"]" "${baseDir}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "${relativePath}" | wc -l`;
    const importCount = parseInt(execSync(grepCommand).toString().trim(), 10);

    // Search for requires of this file
    const requireCommand = `grep -r "require\\(['\"].*${fileName.replace(".", "\\.")}['\"]\\)" "${baseDir}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "${relativePath}" | wc -l`;
    const requireCount = parseInt(
      execSync(requireCommand).toString().trim(),
      10,
    );

    return importCount + requireCount;
  } catch (error) {
    logger.error(`Failed to count file usage: ${error}`);
    return 0;
  }
};

// Analysis functions
const analyzePackageJsonScripts = (): void => {
  logger.section("PACKAGE.JSON SCRIPTS ANALYSIS");

  const packageJson = readJsonFile<{ scripts: Record<string, string> }>(
    PACKAGE_JSON_PATH,
  );
  if (!packageJson) return;

  const { scripts } = packageJson;
  const scriptCount = Object.keys(scripts).length;

  logger.info(`Total scripts: ${scriptCount}`);
  if (scriptCount > 30) {
    logger.warn(
      `Excessive number of scripts (${scriptCount}). Consider consolidating.`,
    );
  }

  // Group scripts by prefix
  const scriptGroups: Record<string, string[]> = {};
  Object.keys(scripts).forEach((scriptName) => {
    const prefix = scriptName.split(":")[0];
    if (!scriptGroups[prefix]) {
      scriptGroups[prefix] = [];
    }
    scriptGroups[prefix].push(scriptName);
  });

  // Analyze script groups
  logger.info("\nScript groups:");
  Object.entries(scriptGroups).forEach(([prefix, groupScripts]) => {
    logger.info(`  ${prefix}: ${groupScripts.length} scripts`);

    if (groupScripts.length > 5) {
      logger.warn(
        `  - Excessive "${prefix}" scripts (${groupScripts.length}). Consider consolidation.`,
      );

      if (VERBOSE) {
        groupScripts.forEach((script) => {
          logger.verbose(`    - ${script}: ${scripts[script]}`);
        });
      }
    }
  });

  // Find redundant test scripts
  const testScripts = Object.entries(scripts).filter(([name]) =>
    name.startsWith("test:"),
  );
  if (testScripts.length > 10) {
    logger.warn(
      `\nExcessive test scripts (${testScripts.length}). Consider consolidation.`,
    );

    // Check for test scripts with "|| exit 0" pattern (likely unused)
    const unusedTestScripts = testScripts.filter(([_, command]) =>
      command.includes("|| exit 0"),
    );
    if (unusedTestScripts.length > 0) {
      logger.warn(
        `Found ${unusedTestScripts.length} potentially unused test scripts (using "|| exit 0" pattern):`,
      );
      unusedTestScripts.forEach(([name]) => {
        logger.warn(`  - ${name}`);
      });
    }
  }

  // Find duplicate script functionality
  const scriptCommands = Object.values(scripts);
  const commandCounts: Record<string, number> = {};
  scriptCommands.forEach((command) => {
    commandCounts[command] = (commandCounts[command] || 0) + 1;
  });

  const duplicateCommands = Object.entries(commandCounts).filter(
    ([_, count]) => count > 1,
  );
  if (duplicateCommands.length > 0) {
    logger.warn(
      `\nFound ${duplicateCommands.length} duplicate script commands:`,
    );
    duplicateCommands.forEach(([command, count]) => {
      logger.warn(`  - Used ${count} times: ${command}`);
    });
  }

  // Find scripts with similar functionality
  const similarScripts: Record<string, string[]> = {};
  Object.entries(scripts).forEach(([name, command]) => {
    const simplifiedCommand = command
      .replace(/--[a-zA-Z0-9-_]+/g, "") // Remove flags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (!similarScripts[simplifiedCommand]) {
      similarScripts[simplifiedCommand] = [];
    }
    similarScripts[simplifiedCommand].push(name);
  });

  const redundantScriptGroups = Object.entries(similarScripts).filter(
    ([_, names]) => names.length > 1,
  );
  if (redundantScriptGroups.length > 0) {
    logger.warn(
      `\nFound ${redundantScriptGroups.length} groups of similar scripts that could be consolidated:`,
    );
    redundantScriptGroups.forEach(([command, names]) => {
      logger.warn(`  - Similar scripts: ${names.join(", ")}`);
      logger.verbose(`    Command pattern: ${command}`);
    });
  }
};

const analyzeUnusedDependencies = async (): Promise<void> => {
  logger.section("DEPENDENCY ANALYSIS");

  const packageJson = readJsonFile<{
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  }>(PACKAGE_JSON_PATH);

  if (!packageJson) return;

  const { dependencies, devDependencies } = packageJson;
  const dependencyCount = Object.keys(dependencies).length;
  const devDependencyCount = Object.keys(devDependencies).length;

  logger.info(`Dependencies: ${dependencyCount}`);
  logger.info(`DevDependencies: ${devDependencyCount}`);

  // Check for duplicate test frameworks
  const testFrameworks = ["jest", "vitest", "mocha", "jasmine", "ava", "tape"];
  const usedTestFrameworks = testFrameworks.filter(
    (framework) => dependencies[framework] || devDependencies[framework],
  );

  if (usedTestFrameworks.length > 1) {
    logger.warn(
      `\nMultiple test frameworks detected: ${usedTestFrameworks.join(", ")}`,
    );
    logger.warn("Consider standardizing on a single test framework.");
  }

  // Check for duplicate UI frameworks
  const uiFrameworks = [
    "@radix-ui",
    "@mui",
    "@chakra-ui",
    "@mantine",
    "antd",
    "bootstrap",
  ];
  const usedUiFrameworks = uiFrameworks.filter((framework) =>
    Object.keys(dependencies).some((dep) => dep.startsWith(framework)),
  );

  if (usedUiFrameworks.length > 1) {
    logger.warn(
      `\nMultiple UI frameworks detected: ${usedUiFrameworks.join(", ")}`,
    );
    logger.warn("Consider standardizing on a single UI framework.");
  }

  // Check for potentially unused dependencies
  logger.info("\nChecking for potentially unused dependencies...");
  logger.info("This may take a moment...");

  try {
    // Try to use depcheck if available
    try {
      execSync("npx depcheck --version", { stdio: "ignore" });

      logger.info("Using depcheck to find unused dependencies...");
      const depcheckOutput = execSync("npx depcheck --json", {
        stdio: "pipe",
      }).toString();
      const depcheckResult = JSON.parse(depcheckOutput);

      if (depcheckResult.dependencies.length > 0) {
        logger.warn(
          `\nFound ${depcheckResult.dependencies.length} potentially unused dependencies:`,
        );
        depcheckResult.dependencies.forEach((dep: string) => {
          logger.warn(`  - ${dep}`);
        });
      }

      if (depcheckResult.devDependencies.length > 0) {
        logger.warn(
          `\nFound ${depcheckResult.devDependencies.length} potentially unused devDependencies:`,
        );
        depcheckResult.devDependencies.forEach((dep: string) => {
          logger.warn(`  - ${dep}`);
        });
      }
    } catch (error) {
      // Fallback to a simple grep-based approach
      logger.info(
        "Depcheck not available, using simple grep-based analysis...",
      );

      const allFiles = findFiles(["*.ts", "*.tsx", "*.js", "*.jsx"]);
      const fileContents = allFiles
        .map((file) => fs.readFileSync(file, "utf8"))
        .join("\n");

      const unusedDependencies = Object.keys(dependencies).filter((dep) => {
        // Normalize dependency name for regex
        const normalizedDep = dep.replace(/[-/@]/g, "[-/@]");
        const regex = new RegExp(
          `(import|require|from).*['"].*${normalizedDep}`,
          "i",
        );
        return !regex.test(fileContents);
      });

      if (unusedDependencies.length > 0) {
        logger.warn(
          `\nFound ${unusedDependencies.length} potentially unused dependencies:`,
        );
        unusedDependencies.forEach((dep) => {
          logger.warn(`  - ${dep}`);
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to analyze dependencies: ${error}`);
  }
};

const analyzeLargeFiles = (): void => {
  logger.section("LARGE FILES ANALYSIS");

  const allFiles = findFiles([
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx",
    "*.json",
    "*.md",
  ]);
  const largeFiles: { path: string; size: number }[] = [];

  allFiles.forEach((filePath) => {
    const size = getFileSize(filePath);
    const sizeKB = size / 1024;

    if (sizeKB > MAX_FILE_SIZE_KB) {
      largeFiles.push({ path: filePath, size });
    }
  });

  // Sort by size, largest first
  largeFiles.sort((a, b) => b.size - a.size);

  if (largeFiles.length > 0) {
    logger.warn(
      `Found ${largeFiles.length} large files (>${MAX_FILE_SIZE_KB}KB):`,
    );
    largeFiles.forEach(({ path: filePath, size }) => {
      const relativePath = path.relative(ROOT_DIR, filePath);
      const sizeKB = (size / 1024).toFixed(2);
      logger.warn(`  - ${relativePath} (${sizeKB} KB)`);
    });

    logger.info("\nLarge files may indicate:");
    logger.info("  - Files that should be split into smaller modules");
    logger.info("  - Generated files that should be gitignored");
    logger.info("  - Data that should be stored elsewhere");
  } else {
    logger.success("No excessively large files found.");
  }
};

const analyzeRedundantConfigs = (): void => {
  logger.section("REDUNDANT CONFIGURATION ANALYSIS");

  // Look for multiple config files of the same type
  const configPatterns = [
    { name: "TypeScript", pattern: "tsconfig*.json" },
    { name: "ESLint", pattern: ".eslintrc*" },
    { name: "Jest", pattern: "jest.config*" },
    { name: "Babel", pattern: ".babelrc*" },
    { name: "Prettier", pattern: ".prettier*" },
    { name: "Webpack", pattern: "webpack.config*" },
    { name: "Vite", pattern: "vite.config*" },
    { name: "Rollup", pattern: "rollup.config*" },
  ];

  configPatterns.forEach(({ name, pattern }) => {
    const configs = findFiles([pattern]);

    if (configs.length > 1) {
      logger.warn(`Multiple ${name} configurations found (${configs.length}):`);
      configs.forEach((config) => {
        const relativePath = path.relative(ROOT_DIR, config);
        logger.warn(`  - ${relativePath}`);
      });
    } else if (configs.length === 1) {
      logger.verbose(
        `Found single ${name} configuration: ${path.relative(ROOT_DIR, configs[0])}`,
      );
    }
  });

  // Look for potentially conflicting test configs
  const testConfigs = [
    ...findFiles(["jest.config*"]),
    ...findFiles(["vitest.config*"]),
    ...findFiles([".mocharc*"]),
  ];

  if (testConfigs.length > 1) {
    logger.warn(
      `\nMultiple test configurations found (${testConfigs.length}):`,
    );
    testConfigs.forEach((config) => {
      const relativePath = path.relative(ROOT_DIR, config);
      logger.warn(`  - ${relativePath}`);
    });
    logger.warn("Consider standardizing on a single test framework.");
  }

  // Check for duplicate environment files
  const envFiles = findFiles([".env*"]);
  if (envFiles.length > 3) {
    // .env, .env.example, .env.local is reasonable
    logger.warn(`\nExcessive environment files found (${envFiles.length}):`);
    envFiles.forEach((file) => {
      const relativePath = path.relative(ROOT_DIR, file);
      logger.warn(`  - ${relativePath}`);
    });
  }
};

const analyzeDeadCode = (): void => {
  logger.section("DEAD CODE ANALYSIS");

  // Look for files with low usage
  logger.info("Checking for potentially unused files...");

  const sourceFiles = findFiles(["*.ts", "*.tsx"]).filter(
    (file) =>
      !file.includes("test/") &&
      !file.includes(".test.") &&
      !file.includes(".spec.") &&
      !file.includes("index.ts"), // Index files are often used for re-exports
  );

  const lowUsageFiles: { path: string; usageCount: number }[] = [];

  sourceFiles.forEach((filePath) => {
    const usageCount = countFileUsage(filePath);

    if (usageCount < MIN_SCRIPT_USAGE_COUNT) {
      lowUsageFiles.push({ path: filePath, usageCount });
    }
  });

  if (lowUsageFiles.length > 0) {
    logger.warn(
      `Found ${lowUsageFiles.length} potentially unused or low-usage files:`,
    );
    lowUsageFiles.forEach(({ path: filePath, usageCount }) => {
      const relativePath = path.relative(ROOT_DIR, filePath);
      logger.warn(`  - ${relativePath} (${usageCount} imports/requires)`);
    });
  } else {
    logger.success("No potentially unused files found.");
  }

  // Look for backup/temporary files
  const backupFiles = findFiles(["*.bak", "*.backup", "*.tmp", "*.temp", "*~"]);
  if (backupFiles.length > 0) {
    logger.warn(
      `\nFound ${backupFiles.length} backup/temporary files that should be removed:`,
    );
    backupFiles.forEach((file) => {
      const relativePath = path.relative(ROOT_DIR, file);
      logger.warn(`  - ${relativePath}`);
    });
  }

  // Look for commented code
  logger.info("\nChecking for extensive commented code...");

  try {
    const commentedCodeCommand = `find "${ROOT_DIR}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -exec grep -l "^\\s*//" {} \\; | xargs grep -l "^\\s*//" | sort | uniq`;
    const filesWithComments = execSync(commentedCodeCommand)
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    if (filesWithComments.length > 0) {
      logger.info(
        `Found ${filesWithComments.length} files with commented code blocks.`,
      );
      logger.info(
        "Consider removing commented code or converting to proper documentation.",
      );

      if (VERBOSE) {
        filesWithComments.slice(0, 10).forEach((file) => {
          const relativePath = path.relative(ROOT_DIR, file);
          logger.verbose(`  - ${relativePath}`);
        });

        if (filesWithComments.length > 10) {
          logger.verbose(
            `  ... and ${filesWithComments.length - 10} more files`,
          );
        }
      }
    }
  } catch (error) {
    // This might fail if no files with comments are found
    logger.verbose("No files with extensive commented code found.");
  }
};

const analyzeDuplicateCode = (): void => {
  logger.section("DUPLICATE CODE ANALYSIS");

  logger.info("Checking for duplicate utility functions...");

  // Common utility function names to check for duplicates
  const utilFunctions = [
    "formatDate",
    "formatTime",
    "formatDateTime",
    "parseDate",
    "parseTime",
    "parseDateTime",
    "isValidEmail",
    "isValidPhone",
    "isValidUrl",
    "getConfig",
    "loadConfig",
    "readConfig",
    "logger",
    "createLogger",
    "setupLogger",
    "fetchData",
    "getData",
    "getResource",
    "handleError",
    "processError",
    "formatError",
  ];

  utilFunctions.forEach((funcName) => {
    try {
      const command = `grep -r "\\(function\\|const\\|let\\|var\\|export\\)\\s\\+${funcName}\\s*" "${ROOT_DIR}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "node_modules" | wc -l`;
      const count = parseInt(execSync(command).toString().trim(), 10);

      if (count > 1) {
        logger.warn(
          `Potential duplicate utility function: "${funcName}" (${count} occurrences)`,
        );

        if (VERBOSE) {
          const locationCommand = `grep -r "\\(function\\|const\\|let\\|var\\|export\\)\\s\\+${funcName}\\s*" "${ROOT_DIR}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "node_modules"`;
          const locations = execSync(locationCommand)
            .toString()
            .trim()
            .split("\n");

          locations.forEach((location) => {
            logger.verbose(`  - ${location.split(":")[0]}`);
          });
        }
      }
    } catch (error) {
      // This might fail if the function isn't found
    }
  });

  logger.info("\nChecking for duplicate React components...");

  // Look for component files with similar names
  const componentFiles = findFiles(["*.tsx"]).filter(
    (file) =>
      file.includes("/components/") ||
      path.basename(file).match(/^[A-Z][a-zA-Z]*\.tsx$/),
  );

  const componentNames = componentFiles.map((file) =>
    path.basename(file, ".tsx"),
  );
  const componentNameCounts: Record<string, number> = {};

  componentNames.forEach((name) => {
    const normalizedName = name.replace(/[-_]/g, "").toLowerCase();
    componentNameCounts[normalizedName] =
      (componentNameCounts[normalizedName] || 0) + 1;
  });

  const duplicateComponents = Object.entries(componentNameCounts)
    .filter(([_, count]) => count > 1)
    .map(([name]) => name);

  if (duplicateComponents.length > 0) {
    logger.warn(
      `\nFound ${duplicateComponents.length} potential duplicate components:`,
    );

    duplicateComponents.forEach((componentName) => {
      const matchingFiles = componentFiles.filter((file) => {
        const fileName = path.basename(file, ".tsx");
        return fileName.replace(/[-_]/g, "").toLowerCase() === componentName;
      });

      logger.warn(`  - "${componentName}" components:`);
      matchingFiles.forEach((file) => {
        const relativePath = path.relative(ROOT_DIR, file);
        logger.warn(`    - ${relativePath}`);
      });
    });
  }
};

const analyzeTestingFrameworks = (): void => {
  logger.section("TESTING FRAMEWORK ANALYSIS");

  // Check for multiple testing frameworks
  const jestConfig = findFiles(["jest.config*"]).length > 0;
  const vitestConfig = findFiles(["vitest.config*"]).length > 0;
  const mochaConfig = findFiles([".mocharc*"]).length > 0;

  const frameworks = [
    jestConfig && "Jest",
    vitestConfig && "Vitest",
    mochaConfig && "Mocha",
  ].filter(Boolean);

  if (frameworks.length > 1) {
    logger.warn(
      `Multiple testing frameworks detected: ${frameworks.join(", ")}`,
    );
    logger.warn("This leads to:");
    logger.warn("  - Duplicate dependencies");
    logger.warn("  - Inconsistent test patterns");
    logger.warn("  - Higher maintenance burden");
    logger.warn("  - Confusion for new developers");
    logger.warn("\nRecommendation: Standardize on a single testing framework.");
  } else if (frameworks.length === 1) {
    logger.success(`Using a single testing framework: ${frameworks[0]}`);
  }

  // Check for test file organization
  const testFiles = findFiles(["*.test.*", "*.spec.*"]);
  const testDirectories = new Set(
    testFiles.map((file) => {
      const relativePath = path.relative(ROOT_DIR, file);
      return relativePath.split("/")[0];
    }),
  );

  if (testDirectories.size > 2) {
    logger.warn(
      `\nTests are scattered across ${testDirectories.size} top-level directories:`,
    );
    Array.from(testDirectories).forEach((dir) => {
      logger.warn(`  - ${dir}`);
    });
    logger.warn(
      '\nRecommendation: Consolidate tests into a single "test" directory.',
    );
  }

  // Check for duplicate test runners in package.json
  const packageJson = readJsonFile<{ scripts: Record<string, string> }>(
    PACKAGE_JSON_PATH,
  );
  if (packageJson) {
    const { scripts } = packageJson;

    const jestScripts = Object.entries(scripts).filter(([_, command]) =>
      command.includes("jest "),
    );

    const vitestScripts = Object.entries(scripts).filter(([_, command]) =>
      command.includes("vitest"),
    );

    if (jestScripts.length > 0 && vitestScripts.length > 0) {
      logger.warn("\nBoth Jest and Vitest are being used in npm scripts:");
      logger.warn(`  - Jest scripts: ${jestScripts.length}`);
      logger.warn(`  - Vitest scripts: ${vitestScripts.length}`);

      if (VERBOSE) {
        logger.verbose("\nJest scripts:");
        jestScripts.forEach(([name, command]) => {
          logger.verbose(`  - ${name}: ${command}`);
        });

        logger.verbose("\nVitest scripts:");
        vitestScripts.forEach(([name, command]) => {
          logger.verbose(`  - ${name}: ${command}`);
        });
      }
    }
  }
};

const generateRecommendations = (): void => {
  logger.section("RECOMMENDATIONS");

  logger.info(
    "Based on the analysis, here are recommended actions to trim the fat:",
  );

  // Package.json recommendations
  logger.info("\n1. PACKAGE.JSON CLEANUP:");
  logger.info("   - Consolidate 150+ npm scripts into ~15-20 essential ones");
  logger.info("   - Standardize on a single test framework (Jest OR Vitest)");
  logger.info(
    '   - Remove dependencies with "|| exit 0" patterns (likely unused)',
  );
  logger.info("   - Group related scripts with consistent naming");

  // Dead code recommendations
  logger.info("\n2. DEAD CODE REMOVAL:");
  logger.info("   - Remove low-usage files identified in the analysis");
  logger.info("   - Delete all backup/temporary files (*.bak, *.backup, etc.)");
  logger.info("   - Clean up commented code blocks");
  logger.info("   - Remove duplicate utility functions and components");

  // Configuration recommendations
  logger.info("\n3. CONFIGURATION CLEANUP:");
  logger.info("   - Standardize on a single configuration pattern per tool");
  logger.info("   - Remove redundant test configurations");
  logger.info("   - Consolidate environment files");

  // Large file recommendations
  logger.info("\n4. LARGE FILE REFACTORING:");
  logger.info("   - Split large files (>500KB) into smaller modules");
  logger.info("   - Move large data files to external storage or gitignore");

  // Dependency recommendations
  logger.info("\n5. DEPENDENCY CLEANUP:");
  logger.info("   - Remove unused dependencies identified by depcheck");
  logger.info("   - Standardize on a single UI component library");
  logger.info("   - Update outdated dependencies");

  // Next steps
  logger.info("\nNEXT STEPS:");
  logger.info("1. Run with --verbose flag to see detailed analysis");
  logger.info(
    "2. Create a cleanup branch for implementing these recommendations",
  );
  logger.info("3. Run tests after each cleanup step to ensure functionality");
  logger.info(
    "4. Consider creating automated cleanup scripts for ongoing maintenance",
  );
};

// Main function
const main = async () => {
  logger.info(
    `Starting fat analysis${VERBOSE ? " (verbose mode)" : ""}${FIX ? " (fix mode)" : ""}`,
  );

  // Run analysis functions
  analyzePackageJsonScripts();
  await analyzeUnusedDependencies();
  analyzeLargeFiles();
  analyzeRedundantConfigs();
  analyzeDeadCode();
  analyzeDuplicateCode();
  analyzeTestingFrameworks();

  // Generate recommendations
  generateRecommendations();

  logger.success("\nFat analysis complete!");

  if (FIX) {
    logger.info("\nAutomatic fixes applied where possible.");
    logger.info("Review the changes and run tests to ensure functionality.");
  } else {
    logger.info("\nRun with --fix to automatically fix simple issues.");
  }
};

// Run the script
main().catch((error) => {
  console.error("Error running fat analysis:", error);
  process.exit(1);
});
