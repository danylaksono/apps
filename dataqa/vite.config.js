import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/apps/dataqa/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre-gl': ['maplibre-gl'],
          'duckdb': ['@duckdb/duckdb-wasm'],
          'tanstack-table': ['@tanstack/react-table'],
        },
      },
    },
  },
});
