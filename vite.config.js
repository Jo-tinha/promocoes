import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Páginas: vitrine (index), login/cadastro (entrar), avisos (notificar), painel (admin),
// políticas (privacidade, termos) e página de erro 404 (o Vercel usa o 404.html automaticamente)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        entrar: resolve(import.meta.dirname, 'entrar.html'),
        notificar: resolve(import.meta.dirname, 'notificar.html'),
        loja: resolve(import.meta.dirname, 'loja.html'),
        jogos: resolve(import.meta.dirname, 'jogos.html'),
        busca: resolve(import.meta.dirname, 'busca.html'),
        privacidade: resolve(import.meta.dirname, 'privacidade.html'),
        termos: resolve(import.meta.dirname, 'termos.html'),
        naoEncontrada: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
});
