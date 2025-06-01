const fs = require('fs');
const path = require('path');

// --- Simple recursive file finder for .ts files ---
function findTsFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git' && item !== 'dist' && item !== 'coverage') {
        findTsFiles(fullPath, files);
      }
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

// --- 1. Fix export { Foo } --> export type { Foo } for UPPERCASE identifiers ---
function fixTypeExports(file) {
  let contents = fs.readFileSync(file, 'utf8');
  let changed = false;
  // Look for lines like: export { Foo, Bar }
  contents = contents.replace(/export\s*{\s*([A-Za-z0-9_,\s]+)\s*};?/g, (match, exports) => {
    // Only convert if all are likely types (capitalized, not camelCase)
    const identifiers = exports.split(',').map(e => e.trim());
    const allUpper = identifiers.every(id => id && /^[A-Z]/.test(id));
    if (allUpper) {
      changed = true;
      return `export type { ${identifiers.join(', ')} }`;
    }
    return match;
  });
  if (changed) {
    fs.writeFileSync(file, contents, 'utf8');
    console.log(`[MODIFIED] Type export fixed in: ${file}`);
  }
}

// --- 2. Warn about likely bad Drizzle usage (object passed to .from/.update/.insert) ---
function warnDbObjectUsage(file) {
  const contents = fs.readFileSync(file, 'utf8');
  if (/db\.(select|update|insert)\s*\(\s*{/.test(contents)) {
    console.log(`[WARN] Object literal used in DB method in: ${file}`);
  }
}

// --- 3. Warn about eq(column, 'string') ---
function warnEqStringUsage(file) {
  const contents = fs.readFileSync(file, 'utf8');
  // Looks for eq(XXX.YYY, 'someString') or eq(XXX.YYY, "someString")
  const eqStringPattern = /eq\([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+,\s*['"][^'"]+['"]\)/g;
  if (eqStringPattern.test(contents)) {
    console.log(`[WARN] eq() may be comparing column to string literal in: ${file}`);
  }
}

// ---- MAIN ----
const files = findTsFiles('.');
files.forEach(file => {
  fixTypeExports(file);
  warnDbObjectUsage(file);
  warnEqStringUsage(file);
});
console.log(`Codemod and static analysis complete. Processed ${files.length} TypeScript files.`);