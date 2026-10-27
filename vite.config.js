import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Páginas: vitrine (index), login/cadastro (entrar), avisos do usuário (notificar) e painel do admin (admin)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        entrar: resolve(import.meta.dirname, 'entrar.html'),
        notificar: resolve(import.meta.dirname, 'notificar.html'),
      },
    },
  },
});
