import { defineConfig } from 'vite';

export default defineConfig({
  root: './public',
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/_system': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
