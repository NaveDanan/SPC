import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envPrefix: ["VITE_", "AI_"],
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "chart-vendor": [
            "chart.js",
            "react-chartjs-2",
            "chartjs-plugin-annotation",
            "chartjs-plugin-zoom"
          ],
          "data-vendor": ["xlsx", "papaparse", "jstat"],
          "ui-vendor": ["lucide-react", "@tanstack/react-table", "react-dropzone"]
        }
      }
    }
  }
});
