import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true, overlay: false }),
    runtimeErrorOverlay(),
    themePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@db": path.resolve(__dirname, "db"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/fonts.googleapis.com': {
        target: 'https://fonts.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fonts.googleapis.com/, '')
      },
      '/fonts.gstatic.com': {
        target: 'https://fonts.gstatic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fonts.gstatic.com/, '')
      }
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  },
  optimizeDeps: {
    include: ['jspdf']
  }
});