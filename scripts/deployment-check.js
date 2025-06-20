#!/usr/bin/env node

/**
 * Deployment readiness checker - verifies everything is set up correctly
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const checks = [];
let hasErrors = false;

function check(name, condition, errorMsg, fix) {
  checks.push({ name, success: condition, errorMsg, fix });
  if (!condition) hasErrors = true;
}

console.log('🚀 Deployment Readiness Check\n');

// 1. Check if dist directory exists
const distExists = fs.existsSync(path.join(rootDir, 'dist'));
check('Dist directory exists', distExists, 
  'dist/ directory not found', 
  'Run: npm run build');

// 2. Check server bundle
const serverBundleExists = fs.existsSync(path.join(rootDir, 'dist/index.js'));
check('Server bundle exists', serverBundleExists,
  'dist/index.js not found',
  'Run: npm run build:server');

// 3. Check frontend build in correct location
const frontendIndexExists = fs.existsSync(path.join(rootDir, 'dist/public/index.html'));
check('Frontend index.html in dist/public', frontendIndexExists,
  'dist/public/index.html not found',
  'Run: npm run build or node scripts/fix-build-paths.js');

// 4. Check frontend assets
const assetsExist = fs.existsSync(path.join(rootDir, 'dist/public/assets'));
check('Frontend assets exist', assetsExist,
  'dist/public/assets/ not found',
  'Run: npm run build');

// 5. Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const hasBuildScript = packageJson.scripts && packageJson.scripts.build;
const hasStartScript = packageJson.scripts && packageJson.scripts.start;
check('Build script exists', hasBuildScript,
  'No build script in package.json',
  'Add build script to package.json');
check('Start script exists', hasStartScript,
  'No start script in package.json',
  'Add start script to package.json');

// 6. Check for common dependencies
const deps = packageJson.dependencies || {};
const requiredDeps = ['express', 'pg', 'dotenv', 'bcryptjs', 'jsonwebtoken'];
requiredDeps.forEach(dep => {
  check(`Dependency: ${dep}`, deps[dep],
    `Missing required dependency: ${dep}`,
    `Run: npm install ${dep}`);
});

// 7. Check environment files
const envExample = fs.existsSync(path.join(rootDir, '.env.example'));
check('.env.example exists', envExample,
  '.env.example not found',
  'Create .env.example with all required variables');

// 8. Check render.yaml
const renderYamlExists = fs.existsSync(path.join(rootDir, 'render.yaml'));
check('render.yaml exists', renderYamlExists,
  'render.yaml not found',
  'Create render.yaml configuration');

// 9. Verify Node version compatibility
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
check('Node version >= 20', majorVersion >= 20,
  `Node version ${nodeVersion} detected, Render uses Node 20`,
  'Update Node version or specify in render.yaml');

// 10. Check for TypeScript files in production
const hasTypeScriptInServer = fs.existsSync(path.join(rootDir, 'server/index.ts'));
check('TypeScript compiled', !hasTypeScriptInServer || serverBundleExists,
  'TypeScript files found but no compiled output',
  'Run: npm run build:server');

// Print results
console.log('─'.repeat(60));
checks.forEach(({ name, success, errorMsg, fix }) => {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (!success) {
    console.log(`   Error: ${errorMsg}`);
    console.log(`   Fix: ${fix}\n`);
  }
});

console.log('─'.repeat(60));

if (hasErrors) {
  console.log('\n❌ Deployment is NOT ready. Fix the issues above.');
  console.log('\n📋 Quick fix commands:');
  console.log('1. npm install');
  console.log('2. npm run build');
  console.log('3. node scripts/fix-build-paths.js');
  console.log('4. npm run build  # Run again to ensure everything is built');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed! Your app is ready for deployment.');
  console.log('\n📋 Next steps:');
  console.log('1. Set environment variables in Render dashboard:');
  console.log('   - DATABASE_URL');
  console.log('   - SESSION_SECRET');
  console.log('   - JWT_SECRET');
  console.log('   - OPENAI_API_KEY');
  console.log('2. Commit and push changes');
  console.log('3. Monitor deployment logs in Render');
}

// Additional deployment tips
console.log('\n💡 Deployment Tips:');
console.log('- Test locally first: NODE_ENV=production npm start');
console.log('- Check logs: render logs --tail');
console.log('- Monitor health: curl https://your-app.onrender.com/health');
console.log('- Clear browser cache if UI looks wrong');
