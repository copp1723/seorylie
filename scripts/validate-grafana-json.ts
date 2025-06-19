#!/usr/bin/env tsx

/**
 * Grafana Dashboard JSON Validation Script
 * Part of ADF-W31 Enhanced Monitoring Implementation
 *
 * Validates Grafana dashboard JSON files against schema and best practices
 * Uses Ajv for JSON schema validation
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface DashboardPanel {
  id: number;
  title: string;
  type: string;
  targets?: Array<{
    expr?: string;
    datasource?: {
      type: string;
      uid: string;
    };
  }>;
}

interface GrafanaDashboard {
  id?: number;
  uid: string;
  title: string;
  tags: string[];
  panels: DashboardPanel[];
  templating?: {
    list: Array<{
      name: string;
      type: string;
    }>;
  };
  time: {
    from: string;
    to: string;
  };
  refresh: string;
  schemaVersion: number;
}

class GrafanaValidator {
  private ajv: Ajv;
  private dashboardSchema: object;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);

    // Grafana Dashboard JSON Schema (simplified)
    this.dashboardSchema = {
      type: "object",
      required: ["uid", "title", "panels", "schemaVersion"],
      properties: {
        uid: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
        title: { type: "string", minLength: 1 },
        tags: { type: "array", items: { type: "string" } },
        panels: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "type"],
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              type: { type: "string" },
              targets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    expr: { type: "string" },
                    datasource: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        uid: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        time: {
          type: "object",
          required: ["from", "to"],
          properties: {
            from: { type: "string" },
            to: { type: "string" },
          },
        },
        refresh: { type: "string" },
        schemaVersion: { type: "number", minimum: 1 },
      },
    };
  }

  /**
   * Validate a single dashboard JSON file
   */
  validateDashboard(filePath: string): ValidationResult {
    const result: ValidationResult = {
      file: filePath,
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Read and parse JSON
      const content = readFileSync(filePath, "utf8");
      let dashboard: GrafanaDashboard;

      try {
        dashboard = JSON.parse(content);
      } catch (parseError) {
        result.valid = false;
        result.errors.push(`Invalid JSON: ${parseError}`);
        return result;
      }

      // Schema validation
      const validate = this.ajv.compile(this.dashboardSchema);
      const isValid = validate(dashboard);

      if (!isValid && validate.errors) {
        result.valid = false;
        result.errors.push(
          ...validate.errors.map(
            (err) => `Schema error at ${err.instancePath}: ${err.message}`,
          ),
        );
      }

      // ADF-specific validations
      this.validateADFDashboard(dashboard, result);

      // Best practices validation
      this.validateBestPractices(dashboard, result);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error}`);
    }

    return result;
  }

  /**
   * ADF-specific dashboard validation rules
   */
  private validateADFDashboard(
    dashboard: GrafanaDashboard,
    result: ValidationResult,
  ): void {
    // Check for ADF tags
    if (dashboard.tags?.includes("adf")) {
      // Validate ADF metric usage
      const adfMetrics = [
        "adf_leads_processed_total",
        "ai_response_latency_ms",
        "handover_trigger_total",
        "handover_dossier_generation_ms",
        "handover_email_sent_total",
      ];

      let hasADFMetrics = false;
      dashboard.panels.forEach((panel) => {
        panel.targets?.forEach((target) => {
          if (
            target.expr &&
            adfMetrics.some((metric) => target.expr!.includes(metric))
          ) {
            hasADFMetrics = true;
          }
        });
      });

      if (!hasADFMetrics) {
        result.warnings.push("ADF dashboard should use ADF-specific metrics");
      }

      // Check for required datasource
      dashboard.panels.forEach((panel) => {
        panel.targets?.forEach((target) => {
          if (target.datasource?.type !== "prometheus") {
            result.warnings.push(
              `Panel "${panel.title}" should use Prometheus datasource for ADF metrics`,
            );
          }
        });
      });
    }
  }

  /**
   * General best practices validation
   */
  private validateBestPractices(
    dashboard: GrafanaDashboard,
    result: ValidationResult,
  ): void {
    // Check for unique panel IDs
    const panelIds = dashboard.panels.map((p) => p.id);
    const uniqueIds = new Set(panelIds);
    if (panelIds.length !== uniqueIds.size) {
      result.errors.push("Dashboard has duplicate panel IDs");
    }

    // Check for panel titles
    dashboard.panels.forEach((panel) => {
      if (!panel.title || panel.title.trim() === "") {
        result.warnings.push(`Panel ${panel.id} is missing a title`);
      }
    });

    // Check refresh interval
    if (
      dashboard.refresh &&
      !["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h"].includes(
        dashboard.refresh,
      )
    ) {
      result.warnings.push(`Unusual refresh interval: ${dashboard.refresh}`);
    }

    // Check time range
    if (dashboard.time) {
      const validTimeRanges = [
        "now-1h",
        "now-6h",
        "now-24h",
        "now-7d",
        "now-30d",
      ];
      if (!validTimeRanges.includes(dashboard.time.from)) {
        result.warnings.push(
          `Consider using standard time range instead of: ${dashboard.time.from}`,
        );
      }
    }
  }

  /**
   * Validate all dashboard files in a directory
   */
  validateDirectory(dirPath: string): ValidationResult[] {
    const results: ValidationResult[] = [];

    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        const filePath = join(dirPath, file);
        const stat = statSync(filePath);

        if (stat.isFile() && extname(file) === ".json") {
          results.push(this.validateDashboard(filePath));
        } else if (stat.isDirectory()) {
          // Recursively validate subdirectories
          results.push(...this.validateDirectory(filePath));
        }
      }
    } catch (error) {
      results.push({
        file: dirPath,
        valid: false,
        errors: [`Directory error: ${error}`],
        warnings: [],
      });
    }

    return results;
  }
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  const validator = new GrafanaValidator();
  const dashboardsDir = join(process.cwd(), "monitoring/grafana/dashboards");

  console.log("🔍 Validating Grafana Dashboard JSON files...\n");

  const results = validator.validateDirectory(dashboardsDir);

  let totalFiles = 0;
  let validFiles = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    totalFiles++;
    if (result.valid) {
      validFiles++;
    }
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    // Print result
    const status = result.valid ? "✅" : "❌";
    console.log(`${status} ${result.file}`);

    if (result.errors.length > 0) {
      result.errors.forEach((error) => console.log(`   🔴 ERROR: ${error}`));
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((warning) =>
        console.log(`   🟡 WARNING: ${warning}`),
      );
    }

    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log("");
    }
  }

  // Summary
  console.log("📊 Validation Summary:");
  console.log(`   Files processed: ${totalFiles}`);
  console.log(`   Valid files: ${validFiles}`);
  console.log(`   Invalid files: ${totalFiles - validFiles}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Total warnings: ${totalWarnings}`);

  // Exit with error code if validation failed
  if (totalFiles - validFiles > 0) {
    console.log("\n❌ Validation failed!");
    process.exit(1);
  } else {
    console.log("\n✅ All dashboard files are valid!");
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Validation script failed:", error);
    process.exit(1);
  });
}

export { GrafanaValidator, ValidationResult };
