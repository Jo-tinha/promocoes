// Página "Notificar" (usuário logado): escolher jogos para acompanhar e ver os avisos de promoção
import './style.css';
import { iniciarSessao, atualizarSino } from './sessao.js';
import { listarJogos } from './promocoes.js';
import {
  listarSeguindo,
  seguirJogo,
  deixarDeSeguir,
  definirPrecoAlvo,
  buscarAvisos,
  marcarAvisosComoLidos,
} from './usuarios.js';
import { carregarContexto, precoEmReal, dolarParaReal, nomeDaLoja } from './contexto.js';
import { esc, IMAGEM_PADRAO } from './util.js';

const elPrecisaLogin = document.querySelector('#precisa-login');
const elConteudo = document.querySelector('#conteudo');
const elListaAvisos = document.querySelector('#lista-avisos');
const elNotaAvisos = document.querySelector('#nota-avisos');
const botaoLidos = document.querySelector('#marcar-lidos');
const elListaJogos = document.querySelector('#lista-jogos');
const elNotaJogos = document.querySelector('#nota-jogos');
const elBusca = document.querySelector('#busca-jogos');
const elFiltro = document.querySelector('#filtro-jogos');

let uid = null;
let jogos = [];
let seguindo = new Map(); // gameID → documento seguido

// ---------- Avisos ----------
function linhaAviso(a) {
  return `
    <div class="promo-linha${a.novo ? ' nova' : ''}">
      <img class="miniatura" src="${esc(a.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
      <div class="promo-info">
        <a href="${esc(a.link)}" target="_blank" rel="noopener sponsored"><strong>${esc(a.titulo)}</strong></a>
        <span class="secao-nota">${esc(nomeDaLoja(a.lojaId))} · -${a.desconto}%${a.novo ? '<span class="selo-nova">Novo</span>' : ''}</span>
      </div>
      <div class="promo-preco">
        <span class="preco-antigo">${precoEmReal(a.precoNormal)}</span>
        <strong>${precoEmReal(a.precoPromocional)}</strong>
      </div>
      <a class="botao secundario pequeno" href="${esc(a.link)}" target="_blank" rel="noopener sponsored">Ver na loja</a>
    </div>`;
}

async function carregarAvisos() {
  try {
    const { avisos, novos } = await buscarAvisos(uid, dolarParaReal);
    botaoLidos.hidden = novos === 0;
    if (!seguindo.size) {
      elNotaAvisos.textContent = 'Você ainda não acompanha nenhum jogo. Escolha abaixo.';
      elListaAvisos.innerHTML = '';
      return;
    }
    elNotaAvisos.textContent = avisos.length
      ? `${novos ? `${novos} ${novos === 1 ? 'aviso novo' : 'avisos novos'} · ` : ''}promoções dos jogos que você acompanha`
      : 'Nenhum dos seus jogos está em promoção agora. Avisamos quando entrar.';
    elListaAvisos.innerHTML = avisos.map(linhaAviso).join('');
  } catch (erro) {
    console.error(erro);
    elNotaAvisos.textContent = 'Não foi possível carregar seus avisos.';
  }
}

botaoLidos.addEventListener('click', async () => {
  botaoLidos.disabled = true;
  try {
    await marcarAvisosComoLidos(uid);
    await carregarAvisos();
    atualizarSino(uid);
  } finally {
    botaoLidos.disabled = false;
  }
});

// ---------- Escolher jogos (CRUD de usuarios/{uid}/seguindo) ----------
function itemJogo(j) {
  const seg = seguindo.get(j.gameID);
  const data = j.ultimaPromocaoEm ? j.ultimaPromocaoEm.toDate().toLocaleDateString('pt-BR') : '';
  return `
    <div class="jogo-item${seg ? ' seguindo' : ''}">
      <img src="${esc(j.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
      <div style="min-width:0">
        <strong title="${esc(j.titulo)}">${esc(j.titulo)}</strong>
        <small>${data ? `Última oferta em ${data}` : ''}</small>
        ${
          seg
            ? `<label class="preco-alvo">Avisar até R$
                 <input type="number" min="1" step="1" placeholder="qualquer" value="${seg.precoAlvo ?? ''}" data-alvo="${esc(j.gameID)}" />
               </label>`
            : ''
        }
      </div>
      <button class="botao ${seg ? 'sucesso' : 'secundario'} pequeno" type="button" data-seguir="${esc(j.gameID)}">
        ${seg ? '✓ Notificando' : '🔔 Notificar'}
      </button>
    </div>`;
}

function renderizarJogos() {
  const termo = elBusca.value.trim().toLowerCase();
  const lista = jogos
    .filter((j) => elFiltro.value !== 'seguindo' || seguindo.has(j.gameID))
    .filter((j) => !termo || j.titulo.toLowerCase().includes(termo));
  elNotaJogos.textContent = `Jogos que já estiveram em oferta no Buba Promo · você acompanha ${seguindo.size} de ${jogos.length}.`;
  elListaJogos.innerHTML = lista.length
    ? lista.map(itemJogo).join('')
    : `<div class="aviso">${jogos.length ? 'Nenhum jogo encontrado.' : 'Ainda não há jogos na lista. Eles aparecem quando entram em oferta no Buba Promo.'}</div>`;
}

elBusca.addEventListener('input', renderizarJogos);
elFiltro.addEventListener('change', renderizarJogos);

elListaJogos.addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-seguir]');
  if (!botao) return;
  const gameID = botao.dataset.seguir;
  botao.disabled = true;
  try {
    if (seguindo.has(gameID)) {
      await deixarDeSeguir(uid, gameID);
      seguindo.delete(gameID);
    } else {
      const jogo = jogos.find((j) => j.gameID === gameID);
      await seguirJogo(uid, jogo);
      seguindo.set(gameID, { gameID, precoAlvo: null });
    }
    renderizarJogos();
    carregarAvisos();
    atualizarSino(uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível atualizar. Tente novamente.');
    botao.disabled = false;
  }
});

// Preço-alvo: salva ao sair do campo
elListaJogos.addEventListener('change', async (e) => {
  const campo = e.target.closest('[data-alvo]');
  if (!campo) return;
  const gameID = campo.dataset.alvo;
  const valor = campo.value ? Number(campo.value) : null;
  if (valor !== null && !(valor > 0)) return;
  try {
    await definirPrecoAlvo(uid, gameID, valor);
    seguindo.get(gameID).precoAlvo = valor;
    carregarAvisos();
    atualizarSino(uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível salvar o preço.');
  }
});

// ---------- Início ----------
iniciarSessao('notificar', async ({ usuario }) => {
  elPrecisaLogin.hidden = Boolean(usuario);
  elConteudo.hidden = !usuario;
  if (!usuario) return;
  uid = usuario.uid;
  elListaJogos.innerHTML = '<div class="aviso">Carregando jogos…</div>';
  try {
    await carregarContexto();
    const [listaJogos, listaSeguindo] = await Promise.all([listarJogos(), listarSeguindo(uid)]);
    jogos = listaJogos;
    seguindo = new Map(listaSeguindo.map((s) => [s.gameID, s]));
    renderizarJogos();
    carregarAvisos();
  } catch (erro) {
    console.error(erro);
    elListaJogos.innerHTML = '<div class="aviso erro">Não foi possível carregar os jogos.</div>';
  }
});
