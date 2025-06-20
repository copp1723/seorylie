/// &lt;reference types="vitest" /&gt;
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use ESM and TypeScript
    environment: 'node',
    globals: true,
    
    // Include test files
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
      'server/**/*.{test,spec}.{js,ts}',
      'database/**/*.{test,spec}.{js,ts}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'web-console/**',
      'coverage/**'
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Setup files
    setupFiles: ['tests/setup.ts'],
    
    // Coverage configuration with 80% gate
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Coverage thresholds - pipeline fails if below these
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80
      },
      
      // Include patterns
      include: [
        'server/**/*.{js,ts}',
        'database/**/*.{js,ts}'
      ],
      
      // Exclude patterns
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.{test,spec}.{js,ts}',
        'server/websocket/**', // WebSocket files are harder to test
        'server/middleware/cdnAssets.ts', // CDN middleware
        'coverage/**',
        '**/*.d.ts'
      ]
    }
  },
  
  // Path resolution to match tsconfig.json
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './server'),
      '@config': path.resolve(__dirname, './server/config'),
      '@utils': path.resolve(__dirname, './server/utils'),
      '@routes': path.resolve(__dirname, './server/routes'),
      '@middleware': path.resolve(__dirname, './server/middleware'),
      '@models': path.resolve(__dirname, './server/models'),
      '@shared': path.resolve(__dirname, './shared'),
      '@console': path.resolve(__dirname, './web-console')
    }
  },
  
  // Define mode
  define: {
    'import.meta.vitest': 'undefined'
  }
});

