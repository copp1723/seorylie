import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/vitest-setup.ts'],
    include: [
      'test/unit/adf-lead-processor.test.ts',
      'test/unit/email-service.test.ts', 
      'test/unit/environment-validator.test.ts',
      'test/conversation-orchestrator.test.ts',
      'test/unit/adf-response-orchestrator.test.ts',
      'test/websocket-init.test.ts',
      'test/utility-types.test.ts',
      'test/integration/websocket-observability.test.ts',
      'test/schema-versions.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/*.spec.jest.*',
      '**/e2e/**',
      'test/unit/intent-detection-system.test.ts',
      'test/unit/cache.test.ts',
      'test/unit/logger.test.ts',
      'test/unit/database-integration.test.ts',
      'test/unit/magic-link-auth.test.ts',
      'test/unit/websocket-server.test.ts',
      'test/unit/adf-sms-response-sender.test.ts'
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../client/src'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@server': path.resolve(__dirname, '../../server'),
      '@test': path.resolve(__dirname, '../../test')
    }
  },
  esbuild: {
    target: 'node18'
  }
});