import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 43123,
    proxy: {
      '/api': 'http://localhost:3456',
      '/ws': {
        target: 'ws://localhost:3456',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
});
