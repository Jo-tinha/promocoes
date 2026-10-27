import './style.css';
import { iniciarSessao, atualizarSino } from './sessao.js';
import { listarDestaques } from './destaques.js';
import { listarRecomendacoes, TIPOS } from './recomendacoes.js';
import { listarSeguindo, seguirJogo, deixarDeSeguir } from './usuarios.js';
import { buscarPromocoes, buscarGratis } from './api.js';
import { contexto, carregarContexto, precoEmReal, nomeDaLoja } from './contexto.js';
import { ORDEM_LOJAS, varsDaLoja, lojaPelaPlataforma, imagemGrande } from './lojas.js';
import { formatarReal, esc, hojeISO, IMAGEM_PADRAO } from './util.js';

const $ = (s) => document.querySelector(s);
const elBillboard = $('#billboard');
const elFaixasLojas = $('#faixas-lojas');
const botaoMaisLojas = $('#mais-lojas');

const estado = {
  usuario: null,
  seguindo: new Set(), // gameIDs que o usuário acompanha
  promos: new Map(), // dealID → promoção exibida (para o botão Notificar)
  lojasPendentes: [],
};

const LOJAS_POR_VEZ = 6;

// ---------- Peças visuais ----------
function pilulaLoja(lojaId, textoAlternativo = '') {
  const loja = contexto.lojas.get(lojaId);
  const nome = loja?.nome || textoAlternativo || 'Loja';
  return `<span class="pilula-loja" style="${varsDaLoja(lojaId)}">
    ${loja ? `<img src="${esc(loja.icone)}" alt="" />` : ''}${esc(nome)}</span>`;
}

function metas(p) {
  const itens = [];
  if (p.avaliacaoPct) itens.push(`<span class="meta${p.avaliacaoPct >= 80 ? ' bom' : ''}" title="${esc(p.avaliacao)} na Steam">★ ${p.avaliacaoPct}%</span>`);
  if (p.metacritic) itens.push(`<span class="meta mc" title="Nota no Metacritic">MC ${p.metacritic}</span>`);
  if (p.lancamento) itens.push(`<span class="meta">${p.lancamento.getFullYear()}</span>`);
  if (p.termina) itens.push(`<span class="meta">até ${p.termina.toLocaleDateString('pt-BR')}</span>`);
  return itens.length ? `<div class="metas">${itens.join('')}</div>` : '';
}

function precos(p) {
  const gratis = p.precoPromocional === 0;
  return `<div class="precos">
    ${p.precoNormal > 0 ? `<span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>` : ''}
    <span class="preco-final">${gratis ? 'Grátis' : precoEmReal(p.precoPromocional)}</span>
  </div>`;
}

function botaoSino(p) {
  if (!estado.usuario || !p.gameID) return '';
  const segue = estado.seguindo.has(p.gameID);
  return `<button class="sino" type="button" data-seguir="${esc(p.dealID)}" aria-pressed="${segue}"
            title="${segue ? 'Você recebe avisos deste jogo' : 'Avisar quando este jogo estiver em promoção'}">🔔</button>`;
}

// especial = faixa que mistura lojas (Destaques, Grátis, Busca): mostra a logo da loja pequena no topo
function cartaoJogo(p, { especial = false, i = 0 } = {}) {
  estado.promos.set(p.dealID, p);
  const lojaId = p.lojaId || lojaPelaPlataforma(p.plataformas);
  const gratis = p.precoPromocional === 0;
  return `
    <article class="jogo" data-deal="${esc(p.dealID)}" style="${varsDaLoja(lojaId)};--i:${i}">
      <a class="jogo-capa" href="${esc(p.link)}" target="_blank" rel="noopener sponsored" tabindex="-1">
        <img src="${esc(imagemGrande(p.imagem))}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
        ${especial ? pilulaLoja(lojaId, p.plataformas) : ''}
        ${p.desconto >= 1 ? `<span class="desconto${gratis ? ' gratis' : ''}">${gratis ? 'GRÁTIS' : `-${p.desconto}%`}</span>` : ''}
      </a>
      <div class="jogo-corpo">
        <h3 title="${esc(p.titulo)}">${esc(p.titulo)}</h3>
        ${p.comentario ? `<p class="comentario-dedo">“${esc(p.comentario)}”</p>` : ''}
        ${metas(p)}
        ${precos(p)}
        <div class="jogo-rodape">
          <a href="${esc(p.link)}" target="_blank" rel="noopener sponsored">${gratis ? 'Resgatar' : 'Ver na loja'} →</a>
          ${botaoSino(p)}
        </div>
      </div>
    </article>`;
}

function cartaoRecomendacao(r, i) {
  const cores = { jogo: '#35d39a', noticia: '#5aa9ff', evento: '#b388ff' };
  return `
    <article class="jogo" style="--cor-loja:${cores[r.tipo] || '#ff5c35'};--i:${i}">
      <a class="jogo-capa" href="${esc(r.link)}" target="_blank" rel="noopener" tabindex="-1">
        ${r.imagem ? `<img src="${esc(r.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />` : `<div class="rec-sem-imagem" style="height:100%">${esc(TIPOS[r.tipo] || '')}</div>`}
      </a>
      <div class="jogo-corpo">
        <span class="tipo tipo-${esc(r.tipo)}">${esc(TIPOS[r.tipo] || r.tipo)}</span>
        <h3>${esc(r.titulo)}</h3>
        ${r.descricao ? `<p class="descricao">${esc(r.descricao)}</p>` : ''}
        <div class="jogo-rodape" style="margin-top:auto"><a href="${esc(r.link)}" target="_blank" rel="noopener">Abrir →</a></div>
      </div>
    </article>`;
}

const esqueletos = (n, bloco = false) =>
  (bloco ? '<div class="esqueleto bloco"></div>' : '') + Array.from({ length: n }, () => '<div class="esqueleto"></div>').join('');

const setas = '<button class="seta esq" type="button" aria-label="Rolar para a esquerda">‹</button><button class="seta dir" type="button" aria-label="Rolar para a direita">›</button>';

// ---------- Banner principal ----------
let rotacao;
function renderizarBillboard(itens) {
  clearInterval(rotacao);
  if (!itens.length) return;
  let atual = 0;
  const mostrar = (n) => {
    atual = n;
    const p = itens[n];
    estado.promos.set(p.dealID, p);
    elBillboard.classList.remove('vazio');
    elBillboard.setAttribute('style', varsDaLoja(p.lojaId));
    elBillboard.innerHTML = `
      <div class="billboard-fundo"><img src="${esc(imagemGrande(p.imagem))}" alt="" /></div>
      <div class="container billboard-conteudo" key="${n}">
        <div class="billboard-rotulo">
          <span class="selo-tipo">${p.comentario !== undefined ? 'Destaque' : 'Em alta'}</span>
          ${pilulaLoja(p.lojaId)}
          ${p.desconto >= 1 ? `<span class="desconto" style="position:static">-${p.desconto}%</span>` : ''}
        </div>
        <h1>${esc(p.titulo)}</h1>
        ${p.comentario ? `<p>${esc(p.comentario)}</p>` : ''}
        ${metas(p)}
        ${precos(p)}
        <div class="billboard-acoes">
          <a class="botao" href="${esc(p.link)}" target="_blank" rel="noopener sponsored">Ver na loja</a>
          ${estado.usuario && p.gameID ? `<button class="botao secundario" type="button" data-seguir="${esc(p.dealID)}">${estado.seguindo.has(p.gameID) ? '✓ Notificando' : '🔔 Notificar'}</button>` : ''}
        </div>
      </div>
      ${itens.length > 1 ? `<div class="billboard-pontos">${itens.map((_, k) => `<button type="button" data-ponto="${k}" aria-label="Destaque ${k + 1}" aria-current="${k === n}"></button>`).join('')}</div>` : ''}`;
  };
  mostrar(0);
  elBillboard.onclick = (e) => {
    const ponto = e.target.closest('[data-ponto]');
    if (ponto) {
      mostrar(Number(ponto.dataset.ponto));
      reiniciar();
    }
  };
  const reiniciar = () => {
    clearInterval(rotacao);
    if (itens.length > 1) rotacao = setInterval(() => mostrar((atual + 1) % itens.length), 8000);
  };
  reiniciar();
  estado.reBillboard = () => mostrar(atual);
}

// ---------- Faixas ----------
async function carregarDestaques() {
  const trilho = $('#trilho-destaques');
  trilho.innerHTML = esqueletos(4);
  let destaques = [];
  try {
    destaques = await listarDestaques();
  } catch (erro) {
    console.error(erro);
  }
  if (destaques.length) {
    trilho.innerHTML = destaques.map((p, i) => cartaoJogo(p, { especial: true, i })).join('');
    renderizarBillboard(destaques.slice(0, 5));
  } else {
    $('#faixa-destaques').hidden = true;
    // Sem destaques ainda: o banner mostra as melhores promoções do momento
    try {
      renderizarBillboard((await buscarPromocoes({ ordem: 'Deal Rating', limite: 5 })).filter((p) => p.imagem));
    } catch (erro) {
      console.error(erro);
    }
  }
  estado.destaques = destaques;
}

function blocoLoja(lojaId, lista) {
  const loja = contexto.lojas.get(lojaId);
  const maior = Math.max(...lista.map((p) => p.desconto));
  return `
    <div class="loja-bloco">
      ${loja ? `<img src="${esc(loja.logo)}" alt="" onerror="this.src='${esc(loja.icone)}'" />` : ''}
      <h2>${esc(nomeDaLoja(lojaId))}</h2>
      <span class="stat"><strong>${lista.length}</strong> ofertas</span>
      <span class="stat">até <strong>-${maior}%</strong></span>
      <span class="linha-cor"></span>
    </div>`;
}

async function carregarFaixaLoja(lojaId) {
  const secao = document.createElement('section');
  secao.className = 'faixa';
  secao.setAttribute('style', varsDaLoja(lojaId));
  secao.setAttribute('aria-label', nomeDaLoja(lojaId));
  secao.innerHTML = `${setas}<div class="trilho">${esqueletos(4, true)}</div>`;
  elFaixasLojas.append(secao);
  try {
    const lista = await buscarPromocoes({ lojaId, ordem: 'Deal Rating', limite: 20 });
    if (!lista.length) return secao.remove();
    secao.querySelector('.trilho').innerHTML = blocoLoja(lojaId, lista) + lista.map((p, i) => cartaoJogo(p, { i })).join('');
  } catch (erro) {
    console.error(erro);
    secao.remove();
  }
}

// Carrega as faixas de loja em pares, para não sobrecarregar a API pública
async function carregarMaisLojas() {
  botaoMaisLojas.hidden = true;
  const lote = estado.lojasPendentes.splice(0, LOJAS_POR_VEZ);
  for (let i = 0; i < lote.length; i += 2) {
    await Promise.all(lote.slice(i, i + 2).map(carregarFaixaLoja));
  }
  botaoMaisLojas.hidden = estado.lojasPendentes.length === 0;
}

async function carregarGratis() {
  const lista = $('#lista-gratis');
  try {
    const jogos = await buscarGratis();
    lista.innerHTML = jogos.length
      ? jogos.map((p, i) => cartaoJogo(p, { especial: true, i })).join('')
      : '<div class="aviso">Nenhum jogo grátis no momento.</div>';
  } catch (erro) {
    console.error(erro);
    lista.innerHTML = '<div class="aviso erro">Não foi possível carregar os jogos grátis.</div>';
  }
}

async function carregarRecomendacoes() {
  const faixa = $('#faixa-recomendacoes');
  faixa.hidden = false;
  try {
    const todas = await listarRecomendacoes(30);
    const hoje = hojeISO();
    const deHoje = todas.filter((r) => r.data === hoje);
    const lista = deHoje.length ? deHoje : todas.filter((r) => r.data < hoje).slice(0, 8);
    $('#nota-recs').textContent = deHoje.length ? 'Jogos, notícias e eventos de hoje' : 'Ainda nada para hoje — as mais recentes';
    if (!lista.length) return (faixa.hidden = true);
    $('#trilho-recomendacoes').innerHTML = lista.map(cartaoRecomendacao).join('');
  } catch (erro) {
    console.error(erro);
    faixa.hidden = true;
  }
}

// ---------- Busca em todas as lojas ----------
let espera;
let buscaAtual = 0;
$('#busca').addEventListener('input', (e) => {
  clearTimeout(espera);
  const termo = e.target.value.trim();
  const faixa = $('#faixa-busca');
  if (termo.length < 2) {
    faixa.hidden = true;
    return;
  }
  espera = setTimeout(async () => {
    const id = ++buscaAtual;
    faixa.hidden = false;
    $('#trilho-busca').innerHTML = esqueletos(4);
    try {
      const lista = await buscarPromocoes({ termo, limite: 30 });
      if (id !== buscaAtual) return;
      $('#nota-busca').textContent = `${lista.length} ${lista.length === 1 ? 'promoção' : 'promoções'} para “${termo}”`;
      $('#trilho-busca').innerHTML = lista.length
        ? lista.map((p, i) => cartaoJogo(p, { especial: true, i })).join('')
        : '<div class="aviso">Nenhum jogo em promoção com esse nome.</div>';
    } catch (erro) {
      console.error(erro);
      $('#trilho-busca').innerHTML = '<div class="aviso erro">Não foi possível buscar agora.</div>';
    }
  }, 450);
});

// ---------- Interações ----------
document.addEventListener('click', async (e) => {
  const seta = e.target.closest('.seta');
  if (seta) {
    const trilho = seta.parentElement.querySelector('.trilho');
    trilho.scrollBy({ left: (seta.classList.contains('dir') ? 1 : -1) * trilho.clientWidth * 0.85 });
    return;
  }

  const botao = e.target.closest('[data-seguir]');
  if (!botao || !estado.usuario) return;
  const p = estado.promos.get(botao.dataset.seguir);
  if (!p?.gameID) return;
  botao.disabled = true;
  try {
    if (estado.seguindo.has(p.gameID)) {
      await deixarDeSeguir(estado.usuario.uid, p.gameID);
      estado.seguindo.delete(p.gameID);
    } else {
      await seguirJogo(estado.usuario.uid, { gameID: p.gameID, titulo: p.titulo, imagem: p.imagem });
      estado.seguindo.add(p.gameID);
    }
    // atualiza todos os sinos daquele jogo na página
    document.querySelectorAll('[data-seguir]').forEach((b) => {
      const q = estado.promos.get(b.dataset.seguir);
      if (q?.gameID !== p.gameID) return;
      const segue = estado.seguindo.has(p.gameID);
      if (b.classList.contains('sino')) b.setAttribute('aria-pressed', String(segue));
      else b.textContent = segue ? '✓ Notificando' : '🔔 Notificar';
    });
    atualizarSino(estado.usuario.uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível atualizar seus avisos. Tente novamente.');
  } finally {
    botao.disabled = false;
  }
});

botaoMaisLojas.addEventListener('click', carregarMaisLojas);

// ---------- Início ----------
async function iniciar() {
  await carregarContexto();
  $('#cotacao').innerHTML = contexto.cotacao ? `Dólar: <strong>${formatarReal(contexto.cotacao)}</strong>` : 'Preços em dólar';
  estado.lojasPendentes = ORDEM_LOJAS.filter((id) => contexto.lojas.has(id));
  carregarGratis();
  await carregarDestaques();
  carregarMaisLojas();
}
iniciar();

iniciarSessao('vitrine', async ({ usuario }) => {
  estado.usuario = usuario;
  $('#chamada').hidden = Boolean(usuario);
  estado.seguindo = new Set();
  if (usuario) {
    carregarRecomendacoes();
    try {
      estado.seguindo = new Set((await listarSeguindo(usuario.uid)).map((s) => s.gameID));
    } catch (erro) {
      console.error(erro);
    }
  } else {
    $('#faixa-recomendacoes').hidden = true;
  }
  // redesenha os sinos dos cartões que já estão na tela
  document.querySelectorAll('.jogo[data-deal]').forEach((cartao) => {
    const rodape = cartao.querySelector('.jogo-rodape');
    rodape.querySelector('.sino')?.remove();
    const p = estado.promos.get(cartao.dataset.deal);
    if (p) rodape.insertAdjacentHTML('beforeend', botaoSino(p));
  });
  estado.reBillboard?.();
});
