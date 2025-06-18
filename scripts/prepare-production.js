#!/usr/bin/env node

/**
 * Prepare for production deployment
 * Creates a minimal package.json with only production dependencies
 */

const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Keep only essential scripts
const productionScripts = {
  start: packageJson.scripts.start,
  build: packageJson.scripts.build,
  "build:server": packageJson.scripts["build:server"],
  migrate: packageJson.scripts.migrate,
  "setup:seoworks": packageJson.scripts["setup:seoworks"],
  "setup:ga4-tables": packageJson.scripts["setup:ga4-tables"],
  "update:seoworks": packageJson.scripts["update:seoworks"]
};

// Create production package.json
const productionPackage = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  description: packageJson.description,
  main: packageJson.main,
  scripts: productionScripts,
  dependencies: packageJson.dependencies,
  engines: packageJson.engines
};

// Remove heavy dev dependencies from being installed
delete productionPackage.devDependencies;
delete productionPackage.husky;
delete productionPackage.workspaces;

// Write production package.json
fs.writeFileSync(
  'package.production.json',
  JSON.stringify(productionPackage, null, 2)
);

console.log('✅ Created package.production.json');
console.log('📦 Dependencies:', Object.keys(productionPackage.dependencies).length);
console.log('📜 Scripts:', Object.keys(productionPackage.scripts).length);