import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dir, "client", "src"),
      "@shared": path.resolve(import.meta.dir, "shared"),
      "@assets": path.resolve(import.meta.dir, "assets"),
    },
  },
  root: path.resolve(import.meta.dir, "client"),
  build: {
    outDir: path.resolve(import.meta.dir, "dist/public"),
    emptyOutDir: true,
  },
});
