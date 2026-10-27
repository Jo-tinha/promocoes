// Estrela ⭐: marcar jogos para receber avisos (subcoleção usuarios/{uid}/seguindo).
// Compartilhado pela vitrine, pela página da loja e pelo catálogo Games.
import { listarSeguindo, seguirJogo, deixarDeSeguir } from './usuarios.js';
import { pedirPermissao, permissaoAtual } from './notificacoes.js';
import { atualizarSino } from './sessao.js';
import { esc } from './util.js';

const estado = { usuario: null, estrelados: new Set(), info: new Map() };

export function definirUsuario(usuario) {
  estado.usuario = usuario;
}

export async function carregarEstrelas() {
  estado.estrelados = new Set();
  if (!estado.usuario) return estado.estrelados;
  try {
    estado.estrelados = new Set((await listarSeguindo(estado.usuario.uid)).map((s) => s.gameID));
  } catch (erro) {
    console.error(erro);
  }
  return estado.estrelados;
}

export const estaEstrelado = (gameID) => estado.estrelados.has(gameID);

// grande = botão com texto (banner); senão, botão redondo só com a estrela
export function botaoEstrela(p, { grande = false } = {}) {
  if (!p.gameID) return '';
  estado.info.set(p.gameID, { gameID: p.gameID, titulo: p.titulo, imagem: p.imagem });
  const on = estado.estrelados.has(p.gameID);
  const titulo = on ? 'Estrelado: você recebe avisos deste jogo' : 'Estrelar para ser avisado das promoções';
  return grande
    ? `<button class="botao secundario" type="button" data-estrela="${esc(p.gameID)}" aria-pressed="${on}">${on ? '★ Estrelado' : '☆ Estrelar'}</button>`
    : `<button class="estrela" type="button" data-estrela="${esc(p.gameID)}" aria-pressed="${on}" title="${titulo}" aria-label="${titulo}">${on ? '★' : '☆'}</button>`;
}

function atualizarBotoes(gameID) {
  const on = estado.estrelados.has(gameID);
  document.querySelectorAll(`[data-estrela="${CSS.escape(gameID)}"]`).forEach((b) => {
    b.setAttribute('aria-pressed', String(on));
    if (b.classList.contains('estrela')) b.textContent = on ? '★' : '☆';
    else b.textContent = on ? '★ Estrelado' : '☆ Estrelar';
  });
}

function avisar(texto) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = texto;
  toast.classList.add('visivel');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toast.classList.remove('visivel'), 3500);
}

// Um único ouvinte para a página inteira
export function ativarEstrelas() {
  document.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-estrela]');
    if (!botao) return;
    if (!estado.usuario) {
      avisar('Entre na sua conta para estrelar jogos.');
      setTimeout(() => (location.href = '/entrar.html'), 900);
      return;
    }
    const gameID = botao.dataset.estrela;
    const vaiEstrelar = !estado.estrelados.has(gameID);

    // a permissão tem que ser pedida logo no clique (antes de esperar o banco)
    const pedido = vaiEstrelar && permissaoAtual() === 'default' ? pedirPermissao() : null;

    botao.disabled = true;
    try {
      if (vaiEstrelar) {
        await seguirJogo(estado.usuario.uid, estado.info.get(gameID));
        estado.estrelados.add(gameID);
      } else {
        await deixarDeSeguir(estado.usuario.uid, gameID);
        estado.estrelados.delete(gameID);
      }
      atualizarBotoes(gameID);
      atualizarSino(estado.usuario.uid);
      const permissao = pedido ? await pedido : permissaoAtual();
      if (!vaiEstrelar) avisar('Estrela removida.');
      else if (permissao === 'granted') avisar('Estrelado! Você será notificado quando entrar em promoção.');
      else if (permissao === 'denied') avisar('Estrelado! As notificações estão bloqueadas no navegador; os avisos aparecem em "Avisos".');
      else avisar('Estrelado! Os avisos aparecem em "Avisos".');
    } catch (erro) {
      console.error(erro);
      avisar('Não foi possível atualizar. Tente novamente.');
    } finally {
      botao.disabled = false;
    }
  });
}
