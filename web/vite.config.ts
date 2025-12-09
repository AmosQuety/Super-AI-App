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
  optimizeDeps: {
    include: ["@apollo/client"],
  },
  
});
