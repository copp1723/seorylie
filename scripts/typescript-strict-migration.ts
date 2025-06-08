#!/usr/bin/env tsx

/**
 * TypeScript Strict Migration Script
 * Helps migrate codebase to strict TypeScript settings
 */

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runTypeScriptCheck() {
  console.log("🔍 Running TypeScript strict mode check...");

  try {
    const { stdout, stderr } = await execAsync("npx tsc --noEmit --strict");

    if (stderr) {
      console.error("❌ TypeScript errors found:");
      console.error(stderr);
      return false;
    }

    console.log("✅ TypeScript strict mode check passed");
    return true;
  } catch (error: any) {
    console.error("❌ TypeScript errors found:");
    console.error(error.stdout || error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting TypeScript strict migration...");

  const success = await runTypeScriptCheck();

  if (!success) {
    console.log("\n📝 To fix TypeScript errors:");
    console.log("1. Add type annotations to variables and function parameters");
    console.log("2. Handle null/undefined cases explicitly");
    console.log("3. Use type assertions carefully");
    console.log("4. Enable strict mode gradually by fixing one file at a time");
    process.exit(1);
  }

  console.log("🎉 TypeScript strict migration completed successfully!");
}

main().catch(console.error);
