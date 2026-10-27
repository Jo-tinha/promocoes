import './style.css';
import { iniciarSessao, atualizarSino } from './sessao.js';
import { listarPromocoes } from './promocoes.js';
import { listarRecomendacoes, TIPOS } from './recomendacoes.js';
import { listarSeguindo, seguirJogo, deixarDeSeguir } from './usuarios.js';
import { contexto, carregarContexto, precoEmReal, nomeDaLoja, iconeDaLoja } from './contexto.js';
import { formatarReal, esc, hojeISO, formatarDiaISO, IMAGEM_PADRAO } from './util.js';

const elLojas = document.querySelector('#lojas');
const elGrade = document.querySelector('#grade');
const elBusca = document.querySelector('#busca');
const elOrdem = document.querySelector('#ordem');
const elCotacao = document.querySelector('#cotacao');
const elChamada = document.querySelector('#chamada');
const secRecs = document.querySelector('#sec-recomendacoes');
const gradeRecs = document.querySelector('#grade-recomendacoes');
const notaRecs = document.querySelector('#nota-recomendacoes');

const estado = {
  promocoes: [],
  carregou: false,
  lojaAtiva: '', // '' = todas
  usuario: null,
  seguindo: new Set(), // gameIDs seguidos pelo usuário logado
};

// ---------- Vitrine por loja ----------
function renderizarLojas() {
  const contagem = new Map();
  estado.promocoes.forEach((p) => contagem.set(p.lojaId, (contagem.get(p.lojaId) || 0) + 1));
  const lojas = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const chip = (id, nome, qtd, icone) => `
    <button class="chip" type="button" data-loja="${esc(id)}" aria-pressed="${estado.lojaAtiva === id}">
      ${icone ? `<img src="${esc(icone)}" alt="" />` : ''}${esc(nome)} <span class="qtd">${qtd}</span>
    </button>`;
  elLojas.innerHTML =
    chip('', 'Todas', estado.promocoes.length, '') +
    lojas.map(([id, qtd]) => chip(id, nomeDaLoja(id), qtd, iconeDaLoja(id))).join('');
}

function botaoSeguir(p) {
  if (!estado.usuario) return '';
  const segue = estado.seguindo.has(p.gameID);
  return `<button class="botao ${segue ? 'sucesso' : 'secundario'} pequeno" type="button" data-seguir="${esc(p.gameID)}"
            title="${segue ? 'Você recebe avisos deste jogo' : 'Receber aviso quando este jogo entrar em promoção'}">
            ${segue ? '✓ Notificando' : '🔔 Notificar'}</button>`;
}

function cartao(p) {
  const icone = iconeDaLoja(p.lojaId);
  return `
    <article class="cartao">
      <a class="cartao-imagem" href="${esc(p.link)}" target="_blank" rel="noopener sponsored" tabindex="-1">
        <img src="${esc(p.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
        ${p.desconto >= 1 ? `<span class="selo selo-desconto">-${p.desconto}%</span>` : ''}
      </a>
      <div class="cartao-corpo">
        <span class="categoria">${icone ? `<img src="${esc(icone)}" alt="" />` : ''}${esc(nomeDaLoja(p.lojaId))}</span>
        <h3>${esc(p.titulo)}</h3>
        <div class="precos">
          ${p.desconto >= 1 ? `<span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>` : ''}
          <span class="preco-final">${precoEmReal(p.precoPromocional)}</span>
        </div>
        <div class="cartao-rodape">
          <a href="${esc(p.link)}" target="_blank" rel="noopener sponsored">Ver na loja →</a>
          ${botaoSeguir(p)}
        </div>
      </div>
    </article>`;
}

const ORDENS = {
  recentes: (a, b) => (b.aprovadoEm?.toMillis() ?? 0) - (a.aprovadoEm?.toMillis() ?? 0),
  desconto: (a, b) => b.desconto - a.desconto,
  preco: (a, b) => a.precoPromocional - b.precoPromocional,
};

function renderizarGrade() {
  if (!estado.carregou) return;
  const termo = elBusca.value.trim().toLowerCase();
  const lista = estado.promocoes
    .filter((p) => !estado.lojaAtiva || p.lojaId === estado.lojaAtiva)
    .filter((p) => !termo || p.titulo.toLowerCase().includes(termo))
    .sort(ORDENS[elOrdem.value]);
  elGrade.innerHTML = lista.length
    ? lista.map(cartao).join('')
    : `<div class="aviso">${
        estado.promocoes.length ? 'Nenhuma promoção encontrada com esse filtro.' : 'Nenhuma promoção na vitrine ainda. Volte em breve!'
      }</div>`;
}

async function carregarVitrine() {
  try {
    await carregarContexto();
    // promoções que já terminaram (admin atualizou o preço) não aparecem para o público
    estado.promocoes = (await listarPromocoes()).filter((p) => p.precoPromocional < p.precoNormal);
    estado.carregou = true;
    renderizarLojas();
    renderizarGrade();
  } catch (erro) {
    console.error(erro);
    elGrade.innerHTML = '<div class="aviso erro">Não foi possível carregar a vitrine. Tente recarregar a página.</div>';
  }
}

// ---------- Recomendações do dia (só para quem está logado) ----------
function cartaoRecomendacao(r) {
  const imagem = r.imagem
    ? `<img src="${esc(r.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />`
    : `<div class="rec-sem-imagem">${esc(TIPOS[r.tipo] || '')}</div>`;
  return `
    <article class="cartao">
      <a class="cartao-imagem" href="${esc(r.link)}" target="_blank" rel="noopener" tabindex="-1">${imagem}</a>
      <div class="cartao-corpo">
        <span class="tipo tipo-${esc(r.tipo)}">${esc(TIPOS[r.tipo] || r.tipo)}</span>
        <h3>${esc(r.titulo)}</h3>
        ${r.descricao ? `<p class="descricao">${esc(r.descricao)}</p>` : ''}
        <div class="cartao-rodape">
          <a href="${esc(r.link)}" target="_blank" rel="noopener">Abrir →</a>
          <span class="secao-nota">${formatarDiaISO(r.data)}</span>
        </div>
      </div>
    </article>`;
}

async function carregarRecomendacoes() {
  try {
    const todas = await listarRecomendacoes(30);
    const hoje = hojeISO();
    const deHoje = todas.filter((r) => r.data === hoje);
    const lista = deHoje.length ? deHoje : todas.filter((r) => r.data < hoje).slice(0, 6);
    notaRecs.textContent = deHoje.length
      ? 'Jogos, notícias e eventos escolhidos pela equipe para hoje'
      : 'Ainda não há recomendações para hoje — estas são as mais recentes';
    gradeRecs.innerHTML = lista.length
      ? lista.map(cartaoRecomendacao).join('')
      : '<div class="aviso">Nenhuma recomendação publicada ainda.</div>';
  } catch (erro) {
    console.error(erro);
    gradeRecs.innerHTML = '<div class="aviso erro">Não foi possível carregar as recomendações.</div>';
  }
}

// ---------- Eventos ----------
elLojas.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-loja]');
  if (!chip) return;
  estado.lojaAtiva = chip.dataset.loja;
  renderizarLojas();
  renderizarGrade();
});
elBusca.addEventListener('input', renderizarGrade);
elOrdem.addEventListener('change', renderizarGrade);

elGrade.addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-seguir]');
  if (!botao || !estado.usuario) return;
  const gameID = botao.dataset.seguir;
  const promo = estado.promocoes.find((p) => p.gameID === gameID);
  botao.disabled = true;
  try {
    if (estado.seguindo.has(gameID)) {
      await deixarDeSeguir(estado.usuario.uid, gameID);
      estado.seguindo.delete(gameID);
    } else {
      await seguirJogo(estado.usuario.uid, promo);
      estado.seguindo.add(gameID);
    }
    renderizarGrade();
    atualizarSino(estado.usuario.uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível atualizar seus avisos. Tente novamente.');
    botao.disabled = false;
  }
});

// ---------- Início ----------
carregarContexto().then(() => {
  elCotacao.innerHTML = contexto.cotacao
    ? `Dólar hoje: <strong>${formatarReal(contexto.cotacao)}</strong>`
    : 'Cotação indisponível: preços exibidos em dólar.';
});
carregarVitrine();

iniciarSessao('vitrine', async ({ usuario }) => {
  estado.usuario = usuario;
  elChamada.hidden = Boolean(usuario);
  secRecs.hidden = !usuario;
  estado.seguindo = new Set();
  if (usuario) {
    carregarRecomendacoes();
    try {
      estado.seguindo = new Set((await listarSeguindo(usuario.uid)).map((s) => s.gameID));
    } catch (erro) {
      console.error(erro);
    }
  }
  renderizarGrade();
});
