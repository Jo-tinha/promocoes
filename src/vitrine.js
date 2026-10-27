import './style.css';
import { iniciarSessao } from './sessao.js';
import { listarDestaques } from './destaques.js';
import { listarRecomendacoes, TIPOS } from './recomendacoes.js';
import { definirUsuario, carregarEstrelas, ativarEstrelas, botaoEstrela } from './estrela.js';
import { cartaoJogo as cartaoBase, cartaoAgrupado, agruparPorJogo, pilulaLoja, metas, precos, esqueletos, setas, ativarSetas, redesenharEstrelas } from './cartoes.js';
import { abrirEscolha } from './escolher-loja.js';
import { salvarNoCatalogo } from './catalogo.js';
import { buscarPromocoes, buscarGratis } from './api.js';
import { contexto, carregarContexto, nomeDaLoja, precoEmReal } from './contexto.js';
import { ORDEM_LOJAS, varsDaLoja, imgJogo } from './lojas.js';
import { formatarReal, esc, hojeISO, IMAGEM_PADRAO } from './util.js';

const $ = (s) => document.querySelector(s);

// endereços antigos /?q=jogo agora abrem a página de busca
const qAntigo = new URLSearchParams(location.search).get('q');
if (qAntigo) location.replace(`/busca.html?q=${encodeURIComponent(qAntigo)}`);
const elBillboard = $('#billboard');
const elFaixasLojas = $('#faixas-lojas');
const botaoMaisLojas = $('#mais-lojas');

const estado = {
  usuario: null,
  promos: new Map(), // dealID → promoção exibida (para redesenhar estrelas e salvar no catálogo)
  lojasPendentes: [],
};

const LOJAS_POR_VEZ = 6;

// ---------- Cartões ----------
// Guarda cada promoção exibida e salva no catálogo "Games" (só com usuário logado)
function cartaoJogo(p, opcoes) {
  estado.promos.set(p.dealID, p);
  if (p.agrupado) {
    p.ofertas.forEach((o) => {
      estado.promos.set(o.dealID, o);
      if (o.gameID) salvarDepois(o);
    });
    return cartaoAgrupado(p, opcoes);
  }
  if (p.gameID) salvarDepois(p);
  return cartaoBase(p, opcoes);
}

// Faixas que misturam lojas (Destaques, Grátis): o mesmo jogo em várias lojas vira um cartão só
const cartoesAgrupados = (lista) => agruparPorJogo(lista).map((item, i) => cartaoJogo(item, { especial: true, i })).join('');

let filaCatalogo = [];
let timerCatalogo;
function salvarDepois(p) {
  filaCatalogo.push(p);
  clearTimeout(timerCatalogo);
  timerCatalogo = setTimeout(() => {
    salvarNoCatalogo(filaCatalogo);
    filaCatalogo = [];
  }, 1500);
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
    if (p.agrupado) p.ofertas.forEach((o) => estado.promos.set(o.dealID, o));
    elBillboard.classList.remove('vazio');
    elBillboard.setAttribute('style', varsDaLoja(p.lojaId));
    elBillboard.innerHTML = `
      <div class="billboard-fundo">${imgJogo(p, 'banner', 'fetchpriority="high"')}</div>
      <div class="container billboard-conteudo" key="${n}">
        <div class="billboard-rotulo">
          <span class="selo-tipo">${p.comentario !== undefined ? 'Destaque' : 'Em alta'}</span>
          ${p.agrupado ? `<span class="pilula-loja">${p.ofertas.length} lojas</span>` : pilulaLoja(p.lojaId)}
          ${p.agrupado ? (p.maiorDesconto >= 1 ? `<span class="desconto" style="position:static">até -${p.maiorDesconto}%</span>` : '') : p.desconto >= 1 ? `<span class="desconto" style="position:static">-${p.desconto}%</span>` : ''}
        </div>
        <h1>${esc(p.titulo)}</h1>
        ${p.comentario ? `<p>${esc(p.comentario)}</p>` : ''}
        ${metas(p)}
        ${
          p.agrupado
            ? `<div class="precos"><span class="preco-legenda">média</span><span class="preco-final">${precoEmReal(p.precoMedio)}</span><span class="preco-de">a partir de ${precoEmReal(p.menorPreco)}</span></div>`
            : precos(p)
        }
        <div class="billboard-acoes">
          ${
            p.agrupado
              ? `<button class="botao" type="button" data-escolher="${esc(p.dealID)}">Escolher loja (${p.ofertas.length})</button>`
              : `<a class="botao" href="${esc(p.link)}" target="_blank" rel="noopener sponsored">Ver na loja</a>`
          }
          ${botaoEstrela(p, { grande: true })}
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
    const itens = agruparPorJogo(destaques);
    trilho.innerHTML = cartoesAgrupados(destaques);
    renderizarBillboard(itens.slice(0, 5));
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
      <a class="ver-todas" href="/loja.html?id=${encodeURIComponent(lojaId)}">Ver todas →</a>
      <span class="linha-cor"></span>
    </div>`;
}

async function carregarFaixaLoja(lojaId) {
  const secao = document.createElement('section');
  secao.className = 'faixa';
  secao.setAttribute('style', varsDaLoja(lojaId));
  secao.setAttribute('aria-label', nomeDaLoja(lojaId));
  const loja = contexto.lojas.get(lojaId);
  const linkTodas = `/loja.html?id=${encodeURIComponent(lojaId)}`;
  // cabeçalho fixo acima da faixa: "Ver todas" fica sempre à mão, mesmo com a faixa rolada
  secao.innerHTML = `
    <div class="faixa-cabeca cabeca-loja-faixa">
      <h2>${loja ? `<img src="${esc(loja.icone)}" alt="" />` : ''}${esc(nomeDaLoja(lojaId))}</h2>
      <p class="contagem-faixa"></p>
      <a class="ver-mais" href="${linkTodas}">Ver todas as promoções <span aria-hidden="true">→</span></a>
    </div>
    ${setas}<div class="trilho">${esqueletos(4, true)}</div>`;
  elFaixasLojas.append(secao);
  try {
    const lista = await buscarPromocoes({ lojaId, ordem: 'Deal Rating', limite: 20 });
    if (!lista.length) return secao.remove();
    secao.querySelector('.contagem-faixa').textContent = `até -${Math.max(...lista.map((p) => p.desconto))}%`;
    secao.querySelector('.trilho').innerHTML =
      blocoLoja(lojaId, lista) +
      lista.map((p, i) => cartaoJogo(p, { i })).join('') +
      `<a class="cartao-ver-todas" href="/loja.html?id=${encodeURIComponent(lojaId)}">Ver todas as promoções da ${esc(nomeDaLoja(lojaId))} →</a>`;
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
  const trilho = $('#lista-gratis');
  trilho.innerHTML = esqueletos(4);
  try {
    const jogos = await buscarGratis();
    if (!jogos.length) return ($('#faixa-gratis').hidden = true);
    trilho.innerHTML = cartoesAgrupados(jogos);
  } catch (erro) {
    console.error(erro);
    $('#faixa-gratis').hidden = true;
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

// ---------- Atalhos das lojas ----------
function renderizarAtalhos() {
  $('#atalhos-lojas').innerHTML = ORDEM_LOJAS.filter((id) => contexto.lojas.has(id))
    .slice(0, 10)
    .map((id) => {
      const l = contexto.lojas.get(id);
      return `<a class="chip" href="/loja.html?id=${encodeURIComponent(id)}" style="${varsDaLoja(id)}"><img src="${esc(l.icone)}" alt="" />${esc(l.nome)}</a>`;
    })
    .join('') + '<a class="chip" href="#faixa-gratis">🎁 Grátis</a><a class="chip" href="/jogos.html">⭐ Games</a>';
}

// ---------- Interações ----------
ativarSetas();
ativarEstrelas();
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-escolher]');
  if (!alvo || e.target.closest('[data-estrela]')) return;
  const grupo = estado.promos.get(alvo.dataset.escolher);
  if (grupo?.agrupado) abrirEscolha(grupo);
});
botaoMaisLojas.addEventListener('click', carregarMaisLojas);

// ---------- Início ----------
async function iniciar() {
  await carregarContexto();
  $('#cotacao').innerHTML = contexto.cotacao ? `Dólar: <strong>${formatarReal(contexto.cotacao)}</strong>` : 'Preços em dólar';
  estado.lojasPendentes = ORDEM_LOJAS.filter((id) => contexto.lojas.has(id));
  renderizarAtalhos();
  carregarGratis();
  await carregarDestaques();
  carregarMaisLojas();
}
iniciar();

iniciarSessao('vitrine', async ({ usuario }) => {
  estado.usuario = usuario;
  definirUsuario(usuario);
  $('#chamada').hidden = Boolean(usuario);
  if (usuario) carregarRecomendacoes();
  else $('#faixa-recomendacoes').hidden = true;
  await carregarEstrelas();
  redesenharEstrelas((dealID) => estado.promos.get(dealID));
  estado.reBillboard?.();
  if (usuario) salvarNoCatalogo([...estado.promos.values()]); // jogos que já estavam na tela antes do login
});
