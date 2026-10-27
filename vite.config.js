import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Duas páginas: a vitrine pública (index.html) e o painel do administrador (admin.html)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
