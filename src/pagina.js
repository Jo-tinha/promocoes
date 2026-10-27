// Páginas de texto (privacidade, termos, 404): só cabeçalho, rodapé e aviso de cookies
import './style.css';
import { iniciarSessao } from './sessao.js';
import { abrirPreferenciasCookies } from './site.js';

iniciarSessao('info');

// Link "Preferências de cookies" dentro do texto da política
document.querySelector('#link-cookies')?.addEventListener('click', abrirPreferenciasCookies);
