import './style.css';
import { iniciarSessao } from './sessao.js';
import { listarDestaques } from './destaques.js';
import { listarRecomendacoes, TIPOS } from './recomendacoes.js';
import { definirUsuario, carregarEstrelas, ativarEstrelas, botaoEstrela } from './estrela.js';
import { cartaoJogo as cartaoBase, pilulaLoja, metas, precos, esqueletos, setas, ativarSetas, redesenharEstrelas } from './cartoes.js';
import { salvarNoCatalogo } from './catalogo.js';
import { buscarPromocoes, buscarGratis } from './api.js';
import { contexto, carregarContexto, nomeDaLoja } from './contexto.js';
import { ORDEM_LOJAS, varsDaLoja, imgJogo } from './lojas.js';
import { formatarReal, esc, hojeISO, IMAGEM_PADRAO } from './util.js';
import { guardarPreferencia, lerPreferencia } from './site.js';

const $ = (s) => document.querySelector(s);
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
  if (p.gameID) salvarDepois(p);
  return cartaoBase(p, opcoes);
}

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
    elBillboard.classList.remove('vazio');
    elBillboard.setAttribute('style', varsDaLoja(p.lojaId));
    elBillboard.innerHTML = `
      <div class="billboard-fundo">${imgJogo(p, 'banner', 'fetchpriority="high"')}</div>
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
      <a class="ver-todas" href="/loja.html?id=${encodeURIComponent(lojaId)}">Ver todas →</a>
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
  const lista = $('#lista-gratis');
  try {
    const jogos = await buscarGratis();
    lista.innerHTML = jogos.length
      ? jogos.map((p, i) => cartaoJogo(p, { especial: true, i })).join('')
      : '<div class="aviso">Nenhum jogo grátis no momento.</div>';
    // no computador mostra 8 e um botão para expandir (sem rolagem dentro da coluna)
    if (jogos.length > 8) {
      lista.insertAdjacentHTML(
        'afterend',
        `<button class="botao secundario pequeno ver-todos-gratis" type="button">Ver todos os ${jogos.length} grátis</button>`,
      );
      const botao = lista.nextElementSibling;
      botao.addEventListener('click', () => {
        const coluna = lista.closest('.coluna-gratis');
        coluna.classList.toggle('expandida');
        botao.textContent = coluna.classList.contains('expandida') ? 'Mostrar menos' : `Ver todos os ${jogos.length} grátis`;
      });
    }
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
  guardarPreferencia('busca', termo);
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

// ---------- Coluna Grátis no celular ----------
// No computador ela fica na lateral; em telas menores vai para logo depois dos Destaques
const colunaGratis = document.querySelector('.coluna-gratis');
const layout = document.querySelector('.vitrine-layout');
const telaPequena = matchMedia('(max-width: 1080px)');
function posicionarGratis() {
  if (telaPequena.matches) $('#faixa-destaques').after(colunaGratis);
  else layout.append(colunaGratis);
}
posicionarGratis();
telaPequena.addEventListener('change', posicionarGratis);

// ---------- Interações ----------
ativarSetas();
ativarEstrelas();
botaoMaisLojas.addEventListener('click', carregarMaisLojas);

// ---------- Início ----------
async function iniciar() {
  await carregarContexto();
  $('#cotacao').innerHTML = contexto.cotacao ? `Dólar: <strong>${formatarReal(contexto.cotacao)}</strong>` : 'Preços em dólar';
  estado.lojasPendentes = ORDEM_LOJAS.filter((id) => contexto.lojas.has(id));
  carregarGratis();
  // ?q= vem do botão "Ver ofertas atuais" da página Games; senão, usa a última busca salva (se permitido)
  const pedida = new URLSearchParams(location.search).get('q');
  const ultimaBusca = pedida || lerPreferencia('busca');
  if (ultimaBusca) {
    $('#busca').value = ultimaBusca;
    $('#busca').dispatchEvent(new Event('input'));
    if (pedida) setTimeout(() => $('#faixa-busca').scrollIntoView({ behavior: 'smooth', block: 'center' }), 700);
  }
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
