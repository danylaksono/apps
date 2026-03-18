import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // When deploying under /apps/city-rose/ (GitHub Pages), assets must use the full base path.
  base: '/apps/city-rose/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
