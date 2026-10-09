import { defineConfig } from 'vite';

export default defineConfig({
  base: '/boat-game/',

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },

  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});