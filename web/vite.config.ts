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
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-apollo': ['@apollo/client', 'graphql'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'react-toastify']
        }
      }
    }
  }
});
