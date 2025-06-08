#!/usr/bin/env tsx

import fs from "fs";
import path from "path";

console.log("🔍 Frontend Production Diagnostics\n");

// Check build output
const distPath = path.join(process.cwd(), "dist");
const publicPath = path.join(distPath, "public");
const indexPath = path.join(publicPath, "index.html");
const assetsPath = path.join(publicPath, "assets");

console.log("📁 Build Output Check:");
console.log(`  dist/ exists: ${fs.existsSync(distPath) ? "✅" : "❌"}`);
console.log(
  `  dist/public/ exists: ${fs.existsSync(publicPath) ? "✅" : "❌"}`,
);
console.log(`  index.html exists: ${fs.existsSync(indexPath) ? "✅" : "❌"}`);
console.log(`  assets/ exists: ${fs.existsSync(assetsPath) ? "✅" : "❌"}`);

if (fs.existsSync(assetsPath)) {
  const assets = fs.readdirSync(assetsPath);
  console.log(`  Assets count: ${assets.length}`);
  assets.forEach((asset) => {
    const size = fs.statSync(path.join(assetsPath, asset)).size;
    console.log(`    - ${asset} (${(size / 1024).toFixed(1)}KB)`);
  });
}

// Check index.html content
if (fs.existsSync(indexPath)) {
  console.log("\n📄 index.html Analysis:");
  const content = fs.readFileSync(indexPath, "utf-8");

  // Check for script tags
  const scriptMatches = content.match(/<script[^>]*src="([^"]*)"[^>]*>/g);
  if (scriptMatches) {
    console.log("  JavaScript files:");
    scriptMatches.forEach((match) => {
      const src = match.match(/src="([^"]*)"/)?.[1];
      if (src) {
        const fullPath = path.join(publicPath, src.replace(/^\//, ""));
        const exists = fs.existsSync(fullPath);
        console.log(`    - ${src} ${exists ? "✅" : "❌"}`);
        if (!exists) {
          console.log(`      Expected at: ${fullPath}`);
        }
      }
    });
  }

  // Check for CSS links
  const cssMatches = content.match(/<link[^>]*href="([^"]*\.css)"[^>]*>/g);
  if (cssMatches) {
    console.log("  CSS files:");
    cssMatches.forEach((match) => {
      const href = match.match(/href="([^"]*)"/)?.[1];
      if (href) {
        const fullPath = path.join(publicPath, href.replace(/^\//, ""));
        const exists = fs.existsSync(fullPath);
        console.log(`    - ${href} ${exists ? "✅" : "❌"}`);
        if (!exists) {
          console.log(`      Expected at: ${fullPath}`);
        }
      }
    });
  }

  // Check for root div
  const hasRootDiv = content.includes('<div id="root">');
  console.log(`  Root div present: ${hasRootDiv ? "✅" : "❌"}`);
}

// Check package.json scripts
console.log("\n📦 Build Configuration:");
const packagePath = path.join(process.cwd(), "package.json");
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
  console.log(`  Build script: ${pkg.scripts?.build || "Missing ❌"}`);
  console.log(`  Start script: ${pkg.scripts?.start || "Missing ❌"}`);
  console.log(`  Type: ${pkg.type || "commonjs"}`);
}

// Check Vite config
const viteConfigPath = path.join(process.cwd(), "config/build/vite.config.ts");
if (fs.existsSync(viteConfigPath)) {
  console.log("\n⚡ Vite Configuration:");
  const viteConfig = fs.readFileSync(viteConfigPath, "utf-8");

  // Extract build.outDir
  const outDirMatch = viteConfig.match(/outDir:\s*path\.resolve\([^)]+\)/);
  if (outDirMatch) {
    console.log(`  Output directory config: ${outDirMatch[0]}`);
  }

  // Check for aliases
  const hasAliases = viteConfig.includes("alias:");
  console.log(`  Path aliases configured: ${hasAliases ? "✅" : "❌"}`);
}

// Common issues checklist
console.log("\n🚨 Common Production Issues:");
console.log("  1. Check browser console for JavaScript errors");
console.log("  2. Verify all asset files are accessible (404 errors)");
console.log("  3. Check Content Security Policy headers");
console.log("  4. Verify API endpoints are responding");
console.log("  5. Check for CORS issues");
console.log("  6. Verify environment variables are set");

console.log("\n🔧 Debugging Steps:");
console.log("  1. Run: tsx scripts/debug-production.ts");
console.log("  2. Open browser dev tools and check Console tab");
console.log("  3. Check Network tab for failed requests");
console.log("  4. Test API endpoints: /api/test, /api/user");
console.log("  5. Verify static files load: /assets/*.js, /assets/*.css");
