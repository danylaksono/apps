import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Supports GitHub Pages-style nested deployment path in this monorepo.
  base: '/apps/joyplot/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
      },
      '/api/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/overpass/, ''),
      },
      '/api/photon': {
        target: 'https://photon.komoot.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/photon/, ''),
      },
      '/api/big': {
        target: 'https://geoservices.big.go.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/big/, ''),
      },
    },
  },
})
