// Painel do administrador
import './style.css';
import { iniciarSessao } from './sessao.js';
import { iniciarAveriguar, carregarVitrineAdmin } from './admin-averiguar.js';
import { iniciarRecomendacoesAdmin, carregarRecomendacoesAdmin } from './admin-recomendacoes.js';
import { esc } from './util.js';

const semAcesso = document.querySelector('#sem-acesso');
const semAcessoTexto = document.querySelector('#sem-acesso-texto');
const painel = document.querySelector('#painel');

const abas = {
  averiguar: { painel: document.querySelector('#aba-averiguar') },
  vitrine: { painel: document.querySelector('#aba-vitrine'), carregar: carregarVitrineAdmin },
  recomendacoes: { painel: document.querySelector('#aba-recomendacoes'), carregar: carregarRecomendacoesAdmin },
};

function abrirAba(nome) {
  document.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === nome)));
  Object.entries(abas).forEach(([chave, aba]) => (aba.painel.hidden = chave !== nome));
  abas[nome].carregar?.();
}
document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.aba)));

let iniciado = false;
iniciarSessao('admin', ({ usuario, admin }) => {
  painel.hidden = !admin;
  semAcesso.hidden = admin;

  if (!usuario) {
    semAcessoTexto.innerHTML = '<p>Entre com a conta de administrador.</p><a class="botao" href="/entrar.html">Entrar</a>';
    return;
  }
  if (!admin) {
    // Mostra o UID para facilitar a criação do documento admins/{uid} no console do Firebase
    semAcessoTexto.innerHTML = `
      <p>Sua conta não tem acesso de administrador.</p>
      <p>Para liberar, no console do Firebase crie a coleção <code>admins</code> com um documento cujo ID seja:</p>
      <p><code style="user-select:all;word-break:break-all">${esc(usuario.uid)}</code></p>
      <p>Depois recarregue esta página.</p>`;
    return;
  }
  if (!iniciado) {
    iniciado = true;
    iniciarRecomendacoesAdmin();
    iniciarAveriguar();
    abrirAba('averiguar');
  }
});
