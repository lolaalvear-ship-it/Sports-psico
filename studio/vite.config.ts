import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: la app funciona igual en GitHub Pages (/repo/) que en cualquier otra ruta.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
