import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

// Plugin to resolve path aliases
const aliasPlugin = {
  name: 'alias',
  setup(build) {
    // Resolve @shared imports to the actual shared directory
    build.onResolve({ filter: /^@shared/ }, args => {
      let importPath = args.path.replace('@shared', path.join(rootDir, 'shared'));

      // Handle @shared/index -> shared/index.ts
      if (importPath.endsWith('/index')) {
        importPath = importPath + '.ts';
      }
      // Handle @shared -> shared/index.ts
      else if (importPath === path.join(rootDir, 'shared')) {
        importPath = path.join(rootDir, 'shared', 'index.ts');
      }
      // Handle @shared/something -> shared/something.ts
      else if (!importPath.includes('.')) {
        importPath = importPath + '.ts';
      }

      return { path: importPath };
    });

    // Resolve @server imports to the actual server directory
    build.onResolve({ filter: /^@server/ }, args => {
      let importPath = args.path.replace('@server', path.join(rootDir, 'server'));

      // Handle @server/index -> server/index.ts
      if (importPath.endsWith('/index')) {
        importPath = importPath + '.ts';
      }
      // Handle @server -> server/index.ts
      else if (importPath === path.join(rootDir, 'server')) {
        importPath = path.join(rootDir, 'server', 'index.ts');
      }
      // Handle @server/something -> server/something.ts
      else if (!importPath.includes('.')) {
        importPath = importPath + '.ts';
      }

      return { path: importPath };
    });
  },
};

const commonConfig = {
  platform: 'node',
  format: 'esm',
  bundle: true,
  external: [
    // Node.js built-ins
    'fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 'events', 'stream',
    'buffer', 'querystring', 'os', 'child_process', 'cluster', 'net', 'tls',
    'zlib', 'readline', 'repl', 'vm', 'domain', 'punycode', 'string_decoder',
    'timers', 'tty', 'dgram', 'dns', 'v8', 'worker_threads', 'perf_hooks',
    'inspector', 'async_hooks', 'trace_events', 'wasi', 'constants',
    
    // Production dependencies that should not be bundled
    'pg-native', 'sqlite3', 'mysql', 'mysql2', 'oracledb', 'pg-query-stream',
    'better-sqlite3', 'tedious', 'node-gyp', 'fsevents',
    
    // Optional dependencies
    'cpu-features', 'ioredis', 'redis', 'bull', 'bullmq',
    
    // Large dependencies that work better external
    'axios', 'lodash', 'moment', 'date-fns', 'uuid', 'nanoid',
    'bcrypt', 'jsonwebtoken', 'express', 'socket.io', 'ws',
    'nodemailer', 'handlebars', 'winston', 'prom-client',
    'openai', '@sendgrid/mail', 'twilio', 'drizzle-orm',
    'fast-xml-parser', 'xml-parser', 'mailparser', 'imap',
    'cors', 'helmet', 'express-rate-limit', 'express-session',
    'express-validator', 'cookie-parser', 'csurf', 'dotenv',
    'zod', 'zod-to-json-schema', 'csv-writer', 'gray-matter',
    'colors', 'bottleneck', 'opossum', 'postgres', 'pg',
    '@opentelemetry/api',
    
    // AWS SDK v3 packages - problematic with bundling
    '@aws-sdk/client-s3', '@aws-sdk/lib-storage', '@aws-sdk/s3-request-presigner',
    '@smithy/types', '@smithy/util-utf8', '@smithy/util-base64',
    '@smithy/util-buffer-from', '@smithy/util-stream', '@smithy/core'
  ],
  plugins: [aliasPlugin],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: false, // Keep readable for debugging
  sourcemap: false, // Disable for production
  target: 'node20',
  logLevel: 'info'
};

export async function buildServer() {
  await build({
    ...commonConfig,
    entryPoints: [path.join(rootDir, 'server/index.ts')],
    outfile: path.join(rootDir, 'dist/index.js'),
  });
}

export async function buildAdfWorker() {
  await build({
    ...commonConfig,
    entryPoints: [path.join(rootDir, 'server/adf-worker.ts')],
    outfile: path.join(rootDir, 'dist/adf-worker.js'),
  });
}

export async function buildMaintenance() {
  await build({
    ...commonConfig,
    entryPoints: [path.join(rootDir, 'scripts/maintenance/daily.ts')],
    outfile: path.join(rootDir, 'dist/daily.js'),
  });
}

export async function buildMinimalServer() {
  await build({
    ...commonConfig,
    entryPoints: [path.join(rootDir, 'server/minimal-production-server.ts')],
    outfile: path.join(rootDir, 'dist/minimal-production-server.js'),
  });
}

export async function buildAll() {
  console.log('🔨 Building server bundles...');
  await Promise.all([
    buildServer(),
    buildMinimalServer(),
    buildAdfWorker(),
    buildMaintenance()
  ]);
  console.log('✅ Server build complete');
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildAll().catch(console.error);
}
