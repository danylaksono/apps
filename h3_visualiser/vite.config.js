import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/apps/h3_visualiser/',
  plugins: [react()],
});
