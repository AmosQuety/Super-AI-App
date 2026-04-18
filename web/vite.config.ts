// vite.config.ts

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // This tells Vite: "Let anyone on the Wi-Fi connect"
    port: 5173,
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["@apollo/client"],
  },
  build: {
    // Warn at 400 KB (uncompressed) to catch bundle bloat before it ships.
    // East Africa constraint: even 400 KB is a real cost on 2G.
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework — always needed, cache-busted rarely
          'vendor-core': ['react', 'react-dom', 'react-router-dom'],
          // Animation library — heavy, isolated so pages that don't use it skip it
          'vendor-motion': ['framer-motion'],
          // GraphQL client — split so core loads without waiting for Apollo
          'vendor-apollo': ['@apollo/client', 'graphql'],
          // AI / ML worker modules — large, lazy-loaded, separate chunk prevents
          // them from inflating the initial load for non-AI page paths
          'vendor-ai': ['@xenova/transformers', 'kokoro-js'],
        },
      },
    },
  },
});
