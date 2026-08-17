import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    rolldownOptions: {
      output: {
        // Leaflet and Recharts are large, stable, and change on a different
        // cadence to the dashboard code — worth their own cacheable chunks.
        codeSplitting: {
          groups: [
            { name: "map", test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)/ },
            { name: "charts", test: /node_modules[\\/](recharts|d3-|victory-)/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
