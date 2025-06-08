#!/usr/bin/env node
/**
 * STAB-301 Schema Versioning Framework Verification Script
 *
 * This script validates that the schema versioning framework is properly implemented
 * and that v1 and v2 schemas are correctly defined with distinct properties.
 *
 * Usage: npx tsx scripts/verify-stab-301-schema-versioning.ts
 */

import chalk from "chalk";
import { schemaVersions, v1Schema, v2Schema } from "../db/schema-versions";

// Define verification steps for better organization
interface VerificationStep {
  name: string;
  verify: () => boolean | Promise<boolean>;
  errorMessage?: string;
}

// Track overall verification status
let allPassed = true;
const failures: string[] = [];

/**
 * Run a verification step with proper error handling and logging
 */
async function runVerificationStep(step: VerificationStep): Promise<boolean> {
  try {
    process.stdout.write(`${chalk.cyan("Verifying:")} ${step.name} ... `);

    const result = await step.verify();

    if (result) {
      console.log(chalk.green("✓ PASS"));
      return true;
    } else {
      console.log(chalk.red("✗ FAIL"));
      failures.push(step.errorMessage || step.name);
      return false;
    }
  } catch (error) {
    console.log(chalk.red("✗ ERROR"));
    console.error(
      chalk.red(
        `  Error in "${step.name}": ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    failures.push(
      `${step.name} threw an exception: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

// Define all verification steps
const verificationSteps: VerificationStep[] = [
  {
    name: "Schema versions object exists with v1 and v2 properties",
    verify: () => {
      return (
        schemaVersions !== undefined &&
        typeof schemaVersions === "object" &&
        schemaVersions.v1 !== undefined &&
        schemaVersions.v2 !== undefined
      );
    },
    errorMessage:
      "schemaVersions object is missing or does not have v1/v2 properties",
  },
  {
    name: "Individual v1 and v2 schemas are exported for direct imports",
    verify: () => {
      return (
        v1Schema !== undefined &&
        v2Schema !== undefined &&
        v1Schema === schemaVersions.v1 &&
        v2Schema === schemaVersions.v2
      );
    },
    errorMessage:
      "v1Schema or v2Schema exports are missing or not properly linked to schemaVersions",
  },
  {
    name: "v1 and v2 vehicles tables are distinct",
    verify: () => {
      return (
        schemaVersions.v1.vehicles !== undefined &&
        schemaVersions.v2.vehicles !== undefined &&
        schemaVersions.v1.vehicles !== schemaVersions.v2.vehicles
      );
    },
    errorMessage: "v1.vehicles and v2.vehicles should be distinct objects",
  },
  {
    name: "v2.vehicles has additional fields that v1.vehicles does not have",
    verify: () => {
      if (!schemaVersions.v1.vehicles || !schemaVersions.v2.vehicles)
        return false;

      const v1VehicleColumns = Object.keys(
        schemaVersions.v1.vehicles._.columns,
      );
      const v2VehicleColumns = Object.keys(
        schemaVersions.v2.vehicles._.columns,
      );

      // V2 should have more columns than V1
      if (v2VehicleColumns.length <= v1VehicleColumns.length) return false;

      // Check for specific enhanced fields in V2
      const enhancedFields = [
        "operationMode",
        "aiConfig",
        "leadScore",
        "lifecycleStage",
        "lastInteractionAt",
        "viewCount",
      ];

      return enhancedFields.every(
        (field) =>
          v2VehicleColumns.includes(field) && !v1VehicleColumns.includes(field),
      );
    },
    errorMessage:
      "v2.vehicles should have additional fields not present in v1.vehicles",
  },
  {
    name: "v2.dealerships has enhanced fields that v1.dealerships does not have",
    verify: () => {
      if (!schemaVersions.v1.dealerships || !schemaVersions.v2.dealerships)
        return false;

      const v1DealershipColumns = Object.keys(
        schemaVersions.v1.dealerships._.columns,
      );
      const v2DealershipColumns = Object.keys(
        schemaVersions.v2.dealerships._.columns,
      );

      // Check for specific enhanced fields in V2 dealerships
      const enhancedFields = [
        "operationMode",
        "aiConfig",
        "agentConfig",
        "leadRouting",
      ];

      return enhancedFields.every(
        (field) =>
          v2DealershipColumns.includes(field) &&
          !v1DealershipColumns.includes(field),
      );
    },
    errorMessage:
      "v2.dealerships should have enhanced fields not present in v1.dealerships",
  },
  {
    name: "v1 and v2 vehicles tables have different indexes",
    verify: () => {
      if (!schemaVersions.v1.vehicles || !schemaVersions.v2.vehicles)
        return false;

      const v1Indexes = Object.keys(schemaVersions.v1.vehicles._.indexes);
      const v2Indexes = Object.keys(schemaVersions.v2.vehicles._.indexes);

      // V2 should have additional indexes
      if (v2Indexes.length <= v1Indexes.length) return false;

      // Check for specific v2-only indexes
      return (
        v2Indexes.includes("lifecycleIdx") &&
        v2Indexes.includes("operationModeIdx") &&
        !v1Indexes.includes("lifecycleIdx") &&
        !v1Indexes.includes("operationModeIdx")
      );
    },
    errorMessage: "v1 and v2 vehicles tables should have different indexes",
  },
  {
    name: "All required tables are present in both schema versions",
    verify: () => {
      const requiredTables = [
        "users",
        "conversations",
        "dealerships",
        "vehicles",
      ];

      return requiredTables.every(
        (table) =>
          schemaVersions.v1[table] !== undefined &&
          schemaVersions.v2[table] !== undefined,
      );
    },
    errorMessage: "Some required tables are missing from schema versions",
  },
  {
    name: "Shared tables are maintained as references to the same object",
    verify: () => {
      return (
        schemaVersions.v1.users === schemaVersions.v2.users &&
        schemaVersions.v1.conversations === schemaVersions.v2.conversations
      );
    },
    errorMessage: "Shared tables should be the same reference in both versions",
  },
];

/**
 * Main verification function
 */
async function verifySchemaVersioning() {
  console.log(
    chalk.bold.blue("STAB-301 Schema Versioning Framework Verification"),
  );
  console.log(chalk.blue("================================================="));

  // Run all verification steps
  for (const step of verificationSteps) {
    const passed = await runVerificationStep(step);
    if (!passed) allPassed = false;
  }

  // Print summary
  console.log(chalk.blue("\nVerification Summary:"));
  console.log(chalk.blue("==================="));

  if (allPassed) {
    console.log(chalk.bold.green("✅ ALL CHECKS PASSED"));
    console.log(
      chalk.green("The schema versioning framework is correctly implemented."),
    );
    console.log(
      chalk.green(
        "v1 and v2 schemas are properly defined with distinct properties.",
      ),
    );
    console.log(
      chalk.green(
        "v2.vehicles has additional fields not present in v1.vehicles.",
      ),
    );
  } else {
    console.log(chalk.bold.red("❌ VERIFICATION FAILED"));
    console.log(chalk.red("The following checks failed:"));
    failures.forEach((failure, index) => {
      console.log(chalk.red(`  ${index + 1}. ${failure}`));
    });
    console.log(chalk.red("\nPlease fix these issues before proceeding."));
  }

  // Exit with appropriate status code
  process.exit(allPassed ? 0 : 1);
}

// Run the verification
verifySchemaVersioning().catch((error) => {
  console.error(chalk.red("Unhandled error during verification:"));
  console.error(error);
  process.exit(1);
});
