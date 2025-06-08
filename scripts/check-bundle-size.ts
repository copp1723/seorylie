#!/usr/bin/env tsx

/**
 * STAB-103: Bundle-Size Guard
 *
 * Automatically fails CI builds if the JavaScript bundle size exceeds a defined limit.
 * Compares the size of built assets against a baseline stored in .stabilization/perf.baseline.json
 *
 * Usage: npm run check:bundle-size or tsx scripts/check-bundle-size.ts
 * Exit codes:
 *   0 - Bundle size is within acceptable limits
 *   1 - Bundle size exceeds limits or other error
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

interface BundleSizeBaseline {
  bundle_size: {
    current_size_bytes: number;
    max_allowed_bytes: number;
    size_human_readable: string;
    compression: string;
    status: string;
  };
  validation_rules: {
    max_bundle_size_bytes: number;
    fail_on_size_increase: boolean;
    tolerance_percentage: number;
  };
  timestamp: string;
  baseline_version: string;
}

interface BundleAnalysis {
  clientBundleSize: number;
  serverBundleSize: number;
  totalBundleSize: number;
  files: Array<{
    path: string;
    size: number;
    sizeHuman: string;
  }>;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.warn(`⚠️  Warning: Could not get size for ${filePath}`);
    return 0;
  }
}

/**
 * Get directory size recursively
 */
function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        totalSize += getDirectorySize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not read directory ${dirPath}`);
  }

  return totalSize;
}

/**
 * Analyze bundle sizes
 */
function analyzeBundleSize(): BundleAnalysis {
  const distDir = path.join(ROOT_DIR, "dist");
  const clientAssetsDir = path.join(distDir, "public", "assets");
  const serverBundlePath = path.join(distDir, "index.js");

  const files: Array<{ path: string; size: number; sizeHuman: string }> = [];

  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    throw new Error(
      '❌ Build output directory not found. Please run "npm run build" first.',
    );
  }

  // Analyze client bundle (assets directory)
  let clientBundleSize = 0;
  if (fs.existsSync(clientAssetsDir)) {
    clientBundleSize = getDirectorySize(clientAssetsDir);

    // Get individual file sizes for detailed reporting
    try {
      const assetFiles = fs.readdirSync(clientAssetsDir);
      for (const file of assetFiles) {
        const filePath = path.join(clientAssetsDir, file);
        const size = getFileSize(filePath);
        files.push({
          path: `dist/public/assets/${file}`,
          size,
          sizeHuman: formatBytes(size),
        });
      }
    } catch (error) {
      console.warn("⚠️  Warning: Could not read client assets directory");
    }
  }

  // Analyze server bundle
  let serverBundleSize = 0;
  if (fs.existsSync(serverBundlePath)) {
    serverBundleSize = getFileSize(serverBundlePath);
    files.push({
      path: "dist/index.js",
      size: serverBundleSize,
      sizeHuman: formatBytes(serverBundleSize),
    });
  }

  const totalBundleSize = clientBundleSize + serverBundleSize;

  return {
    clientBundleSize,
    serverBundleSize,
    totalBundleSize,
    files,
  };
}

/**
 * Load baseline configuration
 */
function loadBaseline(): BundleSizeBaseline {
  const baselinePath = path.join(
    ROOT_DIR,
    ".stabilization",
    "bundle.baseline.json",
  );

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`❌ Baseline file not found: ${baselinePath}`);
  }

  try {
    const baselineContent = fs.readFileSync(baselinePath, "utf-8");
    return JSON.parse(baselineContent) as BundleSizeBaseline;
  } catch (error) {
    throw new Error(`❌ Failed to parse baseline file: ${error}`);
  }
}

/**
 * Update the baseline file with current bundle size
 */
function updateBaseline(analysis: BundleAnalysis): void {
  const baselinePath = path.join(
    ROOT_DIR,
    ".stabilization",
    "bundle.baseline.json",
  );

  const baseline: BundleSizeBaseline = {
    bundle_size: {
      current_size_bytes: analysis.totalBundleSize,
      max_allowed_bytes: analysis.totalBundleSize,
      size_human_readable: formatBytes(analysis.totalBundleSize),
      compression: "gzip",
      status: "baseline_updated",
    },
    validation_rules: {
      max_bundle_size_bytes: analysis.totalBundleSize,
      fail_on_size_increase: true,
      tolerance_percentage: 10,
    },
    timestamp: new Date().toISOString(),
    baseline_version: "1.0.0",
  };

  try {
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf-8");
    console.log(`✅ Updated baseline file: ${baselinePath}`);
    console.log(`New baseline size: ${formatBytes(analysis.totalBundleSize)}`);
  } catch (error) {
    console.error(
      `❌ Failed to update baseline file: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  }
}

/**
 * Main bundle size check function
 */
async function checkBundleSize(): Promise<void> {
  console.log("🔍 Checking bundle size...");
  console.log("");

  try {
    // Check if we're in update mode
    const updateMode = process.argv.includes("--update");

    // Analyze current bundle
    const analysis = analyzeBundleSize();

    if (updateMode) {
      updateBaseline(analysis);
      return;
    }

    // Load baseline
    let baseline: BundleSizeBaseline;
    try {
      baseline = loadBaseline();
    } catch (error) {
      console.log(
        "⚠️ Baseline file not found or invalid. Creating a new baseline...",
      );
      updateBaseline(analysis);
      return;
    }

    // Get limits from baseline
    const maxAllowedSize = baseline.validation_rules.max_bundle_size_bytes;
    const tolerancePercentage =
      baseline.validation_rules.tolerance_percentage || 10;
    const maxWithTolerance = Math.floor(
      maxAllowedSize * (1 + tolerancePercentage / 100),
    );

    // Display detailed analysis
    console.log("📊 Bundle Size Analysis");
    console.log("========================");
    console.log(`Client Bundle: ${formatBytes(analysis.clientBundleSize)}`);
    console.log(`Server Bundle: ${formatBytes(analysis.serverBundleSize)}`);
    console.log(`Total Bundle:  ${formatBytes(analysis.totalBundleSize)}`);
    console.log("");

    console.log("📁 Individual Files:");
    for (const file of analysis.files) {
      console.log(`  ${file.path}: ${file.sizeHuman}`);
    }
    console.log("");

    console.log("📏 Size Limits:");
    console.log(
      `Baseline:      ${formatBytes(baseline.bundle_size.current_size_bytes)}`,
    );
    console.log(`Max Allowed:   ${formatBytes(maxAllowedSize)}`);
    console.log(
      `With Tolerance (${tolerancePercentage}%): ${formatBytes(maxWithTolerance)}`,
    );
    console.log(`Current Total: ${formatBytes(analysis.totalBundleSize)}`);
    console.log("");

    // Check if size exceeds limits
    if (analysis.totalBundleSize > maxWithTolerance) {
      const excessBytes = analysis.totalBundleSize - maxWithTolerance;
      const excessPercentage =
        (analysis.totalBundleSize / maxAllowedSize - 1) * 100;

      console.log("❌ Bundle Size Check Failed");
      console.log(
        `Bundle size (${formatBytes(analysis.totalBundleSize)}) exceeds maximum allowed (${formatBytes(maxWithTolerance)})`,
      );
      console.log(
        `Excess: ${formatBytes(excessBytes)} (+${excessPercentage.toFixed(1)}%)`,
      );
      console.log("");
      console.log("💡 Suggestions:");
      console.log("  - Review recent changes for large additions");
      console.log("  - Check for accidentally included large files");
      console.log("  - Consider code splitting for large components");
      console.log('  - Analyze bundle with "npm run analyze" if available');
      console.log(
        "  - Update baseline if increase is intentional: npm run bundle:update",
      );

      process.exit(1);
    }

    // Success
    const remainingBytes = maxWithTolerance - analysis.totalBundleSize;
    const utilizationPercentage =
      (analysis.totalBundleSize / maxAllowedSize) * 100;

    console.log("✅ Bundle Size Check Passed");
    console.log(`Bundle size is within acceptable limits`);
    console.log(`Utilization: ${utilizationPercentage.toFixed(1)}% of maximum`);
    console.log(`Remaining: ${formatBytes(remainingBytes)} before limit`);
  } catch (error) {
    console.error(
      "❌ Bundle size check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

// Run the check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkBundleSize().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
}

export { checkBundleSize, analyzeBundleSize, loadBaseline };
