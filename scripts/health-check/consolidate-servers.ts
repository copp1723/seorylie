#!/usr/bin/env node
/**
 * Consolidate multiple server entry points into a single, configurable server
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = '.backup/server-consolidation';
const SERVER_FILES = [
  'index.js',
  'server-with-db.js',
  'render-server.js',
  'server/index.ts',
  'server/enhanced-index.ts',
  'server/minimal-server.ts',
  'server/minimal-production-server.ts'
];

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🔧 Consolidating Server Entry Points...\n');

// Backup existing files
console.log('📦 Backing up existing server files...');
SERVER_FILES.forEach(file => {
  if (fs.existsSync(file)) {
    const backupPath = path.join(BACKUP_DIR, path.basename(file));
    fs.copyFileSync(file, backupPath);
    console.log(`  ✓ Backed up ${file}`);
  }
});

// Create unified server configuration
const unifiedServerConfig = `/**
 * Unified Server Configuration
 * Single entry point for all server modes
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Determine server mode from environment
const SERVER_MODE = process.env.SERVER_MODE || 'production';
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log(\`🚀 Starting Seorylie Server in \${SERVER_MODE} mode...\`);

// Server configuration based on mode
const serverConfigs = {
  development: {
    port: process.env.PORT || 3000,
    database: true,
    websocket: true,
    hotReload: true,
    logging: 'verbose',
    middleware: ['cors', 'logging', 'errorHandler']
  },
  production: {
    port: process.env.PORT || 8080,
    database: true,
    websocket: true,
    hotReload: false,
    logging: 'error',
    middleware: ['cors', 'security', 'compression', 'logging', 'errorHandler']
  },
  minimal: {
    port: process.env.PORT || 3000,
    database: false,
    websocket: false,
    hotReload: false,
    logging: 'error',
    middleware: ['cors', 'errorHandler']
  },
  test: {
    port: process.env.PORT || 3001,
    database: true,
    websocket: false,
    hotReload: false,
    logging: 'silent',
    middleware: ['cors', 'errorHandler']
  }
};

const config = serverConfigs[SERVER_MODE] || serverConfigs.production;

// Initialize server based on configuration
async function startServer() {
  const express = require('express');
  const app = express();

  // Apply middleware based on configuration
  if (config.middleware.includes('cors')) {
    const cors = require('cors');
    app.use(cors());
  }

  if (config.middleware.includes('compression')) {
    const compression = require('compression');
    app.use(compression());
  }

  if (config.middleware.includes('security')) {
    const helmet = require('helmet');
    app.use(helmet());
  }

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static files
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use(express.static(path.join(__dirname, 'client/dist')));

  // Database connection
  if (config.database) {
    try {
      const { initializeDatabase } = require('./server/config/db');
      await initializeDatabase();
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      if (SERVER_MODE === 'production') {
        process.exit(1);
      }
    }
  }

  // Load routes
  const { setupRoutes } = require('./server/routes');
  setupRoutes(app);

  // WebSocket support
  if (config.websocket) {
    const http = require('http');
    const server = http.createServer(app);
    const { initializeWebSocket } = require('./server/websocket');
    initializeWebSocket(server);
    
    server.listen(config.port, () => {
      console.log(\`✅ Server with WebSocket running on port \${config.port}\`);
    });
  } else {
    app.listen(config.port, () => {
      console.log(\`✅ Server running on port \${config.port}\`);
    });
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

module.exports = { startServer };
`;

// Create the unified server file
fs.writeFileSync('server.js', unifiedServerConfig);
console.log('\n✅ Created unified server.js');

// Update package.json scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = {
  ...packageJson.scripts,
  "start": "SERVER_MODE=production node server.js",
  "start:dev": "SERVER_MODE=development node server.js",
  "start:minimal": "SERVER_MODE=minimal node server.js",
  "start:test": "SERVER_MODE=test node server.js",
  "dev": "SERVER_MODE=development nodemon server.js"
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json scripts');

// Create migration guide
const migrationGuide = `# Server Consolidation Migration Guide

## What Changed

All server entry points have been consolidated into a single \`server.js\` file that uses environment-based configuration.

### Old Files (Backed up to ${BACKUP_DIR})
${SERVER_FILES.map(f => `- ${f}`).join('\n')}

### New Entry Point
- \`server.js\` - Unified server with mode-based configuration

## Usage

### Production Mode (default)
\`\`\`bash
npm start
# or
SERVER_MODE=production node server.js
\`\`\`

### Development Mode
\`\`\`bash
npm run start:dev
# or
SERVER_MODE=development node server.js
\`\`\`

### Minimal Mode (no DB, no WebSocket)
\`\`\`bash
npm run start:minimal
# or
SERVER_MODE=minimal node server.js
\`\`\`

### Test Mode
\`\`\`bash
npm run start:test
# or
SERVER_MODE=test node server.js
\`\`\`

## Environment Variables

- \`SERVER_MODE\` - Server mode (development, production, minimal, test)
- \`NODE_ENV\` - Node environment (development, production)
- \`PORT\` - Server port (defaults based on mode)

## Next Steps

1. Test each mode to ensure functionality
2. Update deployment scripts to use new entry point
3. Remove old server files after verification
4. Update documentation

## Rollback

If you need to rollback:
1. Restore files from \`${BACKUP_DIR}\`
2. Revert package.json changes
3. Delete server.js
`;

fs.writeFileSync('SERVER_CONSOLIDATION_GUIDE.md', migrationGuide);
console.log('✅ Created migration guide: SERVER_CONSOLIDATION_GUIDE.md');

console.log('\n🎉 Server consolidation complete!');
console.log('\nNext steps:');
console.log('1. Test the new unified server: npm start');
console.log('2. Verify all modes work correctly');
console.log('3. Update deployment configurations');
console.log('4. Remove old server files after verification\n');