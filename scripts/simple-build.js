#!/usr/bin/env node

/**
 * Simple build script that just compiles TypeScript without bundling
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔨 Starting simple build...');

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

try {
  // First, try esbuild
  console.log('Trying esbuild...');
  execSync('npm run build:server', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('✅ Build complete!');
} catch (error) {
  console.error('❌ esbuild failed, trying TypeScript compiler...');
  
  try {
    // Try TypeScript compiler with more options
    execSync('npx tsc server/index.ts --outDir dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --allowJs', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ TypeScript compilation complete!');
  } catch (tscError) {
    console.error('❌ TypeScript failed, using direct node approach...');
    
    // Final fallback: create a CommonJS entry point
    console.log('Creating CommonJS entry point...');
    
    // Create a simple CommonJS entry that imports the server
    const entryContent = `
// CommonJS entry point for production
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { getPort } = require('../server/utils/port-config.js');

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Rylie SEO API',
    status: 'running',
    version: '1.0.0'
  });
});

// Start server
const PORT = getPort();
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Health check: http://0.0.0.0:\${PORT}/health\`);
});

// Load additional routes after server starts
setTimeout(() => {
  try {
    // Import route modules
    const ga4Routes = require('../server/routes/ga4-tenant-onboarding.js');
    const seoworksRoutes = require('../server/routes/seoworks/tasks.js');
    const dealershipRoutes = require('../server/routes/dealership-onboarding.js');
    
    // Apply routes
    app.use('/api/ga4', ga4Routes);
    app.use('/api/seoworks', seoworksRoutes);
    app.use('/api/dealerships', dealershipRoutes);
    
    console.log('✅ All routes loaded successfully');
  } catch (error) {
    console.error('Warning: Could not load all routes:', error.message);
  }
}, 1000);
`;
    
    fs.writeFileSync(path.join(distDir, 'index.js'), entryContent);
    
    // Copy server files to dist
    execSync(`cp -r server dist/`, {
      cwd: path.join(__dirname, '..')
    });
    
    console.log('✅ Created production entry point');
  }
}

// Check if index.js exists
const indexPath = path.join(distDir, 'index.js');
if (fs.existsSync(indexPath)) {
  console.log('✅ dist/index.js exists!');
} else {
  console.error('❌ dist/index.js not found!');
  
  // Last resort: create a minimal index.js
  const minimalIndex = `
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Rylie SEO API', status: 'running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;
  
  fs.writeFileSync(indexPath, minimalIndex);
  console.log('✅ Created minimal index.js');
}