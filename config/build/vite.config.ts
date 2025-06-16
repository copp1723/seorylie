import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Enhanced Vite config with explicit Tailwind CSS processing
export default defineConfig({
  root: path.resolve(__dirname, '../../client'),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../../dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, '../../client/index.html'),
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI components library
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-switch',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
          ],
          // Heavy utilities
          'vendor-utils': [
            'date-fns',
            'zod',
            'axios',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
          ],
          // Data visualization
          'vendor-charts': ['recharts'],
          // Rich text/JSON viewers
          'vendor-viewers': ['@uiw/react-json-view'],
        },
        // Better chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `js/[name]-${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          } else if (/css/i.test(ext)) {
            return `css/[name]-[hash][extname]`;
          } else {
            return `assets/[name]-[hash][extname]`;
          }
        },
      },
    },
    sourcemap: true,
    // Optimize CSS to ensure Tailwind styles are properly included
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production', // Drop console in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 500, // 500kb warning
    // Report compressed size
    reportCompressedSize: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../client/src'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@components': path.resolve(__dirname, '../../client/src/components'),
      '@hooks': path.resolve(__dirname, '../../client/src/hooks'),
      '@pages': path.resolve(__dirname, '../../client/src/pages'),
      '@utils': path.resolve(__dirname, '../../client/src/utils'),
    },
  },
  // Enable HMR in development
  server: {
    hmr: true,
    watch: {
      usePolling: true,
    },
  },
  // Optimize dependencies for faster dev server startup
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
