import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Enhanced Vite config with explicit Tailwind CSS processing
export default defineConfig({
  root: path.resolve(__dirname, '../../client'),
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('tailwindcss')({
          config: path.resolve(__dirname, '../../tailwind.config.ts')
        }),
        require('autoprefixer')(),
      ],
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, '../../client/index.html'),
    },
    sourcemap: true,
    // Optimize CSS to ensure Tailwind styles are properly included
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
    },
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
  // Ensure proper loading of CSS files
  optimizeDeps: {
    include: ['tailwindcss', 'autoprefixer'],
  },
})
