import './style.css';
import { iniciarSessao } from './sessao.js';
import { ouvirDestaques, conferirDestaquesAoVivo, comTodasAsLojas } from './destaques.js';
import { listarRecomendacoes, TIPOS } from './recomendacoes.js';
import { definirUsuario, carregarEstrelas, ativarEstrelas, botaoEstrela } from './estrela.js';
import { cartaoJogo as cartaoBase, cartaoAgrupado, agruparPorJogo, pilulaLoja, metas, precos, esqueletos, setas, ativarSetas, redesenharEstrelas } from './cartoes.js';
import { abrirEscolha } from './escolher-loja.js';
import { salvarNoCatalogo } from './catalogo.js';
import { buscarPromocoes, buscarGratis } from './api.js';
import { contexto, carregarContexto, nomeDaLoja, precoEmReal } from './contexto.js';
import { ORDEM_LOJAS, varsDaLoja, imgJogo, chaveDaImagem, idSteam } from './lojas.js';
import { pararTrailer } from './trailer.js';
import { vitrineComoAparece, destaquesAutomaticos } from './rodizio.js';
import { formatarReal, esc, hojeISO, IMAGEM_PADRAO } from './util.js';
import { renderizarComentario } from './texto-rico.js';

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
// Banner: a estrutura (fundo + texto) é criada uma vez; depois só o texto muda e o fundo faz um
// crossfade entre duas camadas — a imagem não é recriada (era o que piscava a cada troca)
function prepararBanner() {
  if (elBillboard.querySelector('.billboard-texto')) return;
  elBillboard.innerHTML = '<div class="billboard-fundo"><div class="camada"></div><div class="camada"></div></div><div class="billboard-texto"></div>';
}

let fundoAtual = '';
const DURACAO_DESLIZE = 1600; // ms (igual ao CSS de .billboard-fundo .camada)
function trocarFundoDoBanner(p) {
  const chave = chaveDaImagem(p, 'banner');
  if (chave === fundoAtual) return; // mesma imagem: não mexe
  fundoAtual = chave;
  const html = imgJogo(p, 'banner', 'fetchpriority="high"');
  const [a, b] = elBillboard.querySelectorAll('.billboard-fundo .camada');
  const visivel = a.classList.contains('ativa') ? a : b;
  const proxima = visivel === a ? b : a;
  proxima.innerHTML = html;
  const img = proxima.querySelector('img');
  let feito = false;
  // o novo entra pela esquerda e empurra o anterior para a direita, devagar
  const mostrar = () => {
    if (feito) return;
    feito = true;
    const tinhaOutro = visivel.classList.contains('ativa');
    proxima.classList.remove('saindo', 'sem-transicao');
    proxima.classList.add('ativa');
    if (!tinhaOutro) return;
    visivel.classList.remove('ativa');
    visivel.classList.add('saindo');
    clearTimeout(visivel._volta);
    // depois que saiu pela direita, volta escondido para a esquerda (sem animar), pronto para o próximo
    visivel._volta = setTimeout(() => {
      visivel.classList.add('sem-transicao');
      visivel.classList.remove('saindo');
      void visivel.offsetWidth;
      visivel.classList.remove('sem-transicao');
    }, DURACAO_DESLIZE + 100);
  };
  if (img.complete && img.naturalWidth) mostrar();
  else {
    img.addEventListener('load', mostrar, { once: true });
    img.addEventListener('error', () => setTimeout(() => img.classList.contains('carregada') && mostrar(), 50));
    // a cadeia de alternativas termina sempre marcando "carregada"; confere de novo depois
    const conferir = setInterval(() => {
      if (img.classList.contains('carregada')) {
        clearInterval(conferir);
        mostrar();
      }
    }, 100);
    setTimeout(() => clearInterval(conferir), 8000);
  }
}

let chaveBillboard = '';
function renderizarBillboard(novos) {
  if (!novos.length) return;
  const chave = novos.map((p) => p.dealID).join('|');
  if (chave === chaveBillboard && estado.atualizarBillboard) return estado.atualizarBillboard(novos);
  chaveBillboard = chave;
  clearInterval(rotacao);
  prepararBanner();
  let itens = novos;
  let atual = 0;
  // suave = só atualiza preço/estrela do mesmo destaque, sem repetir a animação de entrada
  const mostrar = (n, { suave = false } = {}) => {
    atual = n;
    const p = itens[n];
    elBillboard.querySelector('.billboard-texto').classList.toggle('sem-animacao', suave);
    if (!suave) pararTrailer();
    // trailer ao passar o mouse no banner (o do destaque que está aparecendo)
    const video = p.video || p.ofertas?.map((o) => o.video).find(Boolean) || '';
    elBillboard.dataset.steam = p.manual ? '' : idSteam(p) || '';
    if (video) elBillboard.dataset.video = video;
    else delete elBillboard.dataset.video;
    estado.promos.set(p.dealID, p);
    if (p.agrupado) p.ofertas.forEach((o) => estado.promos.set(o.dealID, o));
    elBillboard.classList.remove('vazio');
    elBillboard.setAttribute('style', varsDaLoja(p.lojaId));
    trocarFundoDoBanner(p);
    elBillboard.querySelector('.billboard-texto').innerHTML = `
      <div class="container billboard-conteudo">
        <div class="billboard-rotulo">
          <span class="selo-tipo">${p.comentario !== undefined ? 'Destaque' : 'Em alta'}</span>
          ${p.agrupado ? `<span class="pilula-loja">${p.ofertas.length} lojas</span>` : p.lojaId || p.lojaNome ? pilulaLoja(p.lojaId, p.lojaNome) : ''}
          ${p.agrupado ? (p.maiorDesconto >= 1 ? `<span class="desconto" style="position:static">até -${p.maiorDesconto}%</span>` : '') : p.desconto >= 1 ? `<span class="desconto" style="position:static">-${p.desconto}%</span>` : ''}
        </div>
        <h1>${esc(p.titulo)}</h1>
        ${p.comentario ? `<div class="billboard-comentario comentario-rico">${renderizarComentario(p.comentario)}</div>` : ''}
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
              : `<a class="botao" href="${esc(p.link)}" target="_blank" rel="noopener sponsored">${esc(p.textoBotao || 'Ver na loja')}</a>`
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
    if (itens.length > 1) {
      // com o mouse em cima (vendo o trailer) o banner não troca sozinho
      rotacao = setInterval(() => !elBillboard.matches(':hover') && mostrar((atual + 1) % itens.length), 9000);
      // pré-carrega as imagens dos próximos, para a troca ser instantânea
      itens.forEach((it) => {
        const t = document.createElement('template');
        t.innerHTML = imgJogo(it, 'banner', '');
        const img = t.content.querySelector('img');
        img.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.append(img);
        img.addEventListener('load', () => img.remove(), { once: true });
        setTimeout(() => img.remove(), 15000);
      });
    }
  };
  reiniciar();
  estado.reBillboard = () => mostrar(atual, { suave: true });
  estado.atualizarBillboard = (lista) => {
    itens = lista;
    mostrar(atual, { suave: true });
  };
}

// ---------- Faixas ----------
// Destaques mais rápidos:
// - a consulta ao Firestore começa assim que a página abre, junto com a cotação (não depois dela);
// - a última lista conferida fica guardada na aba (sessionStorage) e aparece na hora ao voltar à vitrine;
// - fica "ouvindo" o Firestore: o que o admin muda aparece sem recarregar a página;
// - os preços são conferidos de novo na CheapShark a cada 2 minutos com a página visível.
const CHAVE_CACHE = 'buba-destaques';
const CONFERIR_A_CADA = 2 * 60 * 1000;

function destaquesGuardados() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_CACHE) || 'null');
  } catch {
    return null;
  }
}
function guardarDestaques(lista) {
  try {
    const leve = lista.map(({ criadoEm, atualizadoEm, ...resto }) => resto);
    sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(leve));
  } catch {
    /* sem armazenamento: só não guarda */
  }
}

let destaquesDoBanco = null;
let conferindo = 0;

async function conferirAgora() {
  if (!destaquesDoBanco?.length) return;
  const status = $('#status-destaques');
  const base = destaquesDoBanco;
  const vez = ++conferindo;
  status.textContent = 'conferindo preços…';
  status.className = 'status-ao-vivo conferindo';
  try {
    const conferidos = await conferirDestaquesAoVivo(base);
    if (vez !== conferindo) return; // chegou uma lista mais nova enquanto conferia
    let ativos = conferidos.filter((d) => d.emPromocao);
    const encerrados = conferidos.length - ativos.length;
    // rodízio: quem completou 24 h no ar dá lugar a uma promoção nova (igual para todos os destaques)
    // e, se faltar destaque, completa sozinho com os melhores da métrica (iguais aos outros)
    try {
      ativos = await vitrineComoAparece(ativos);
    } catch (erro) {
      console.warn('Rodízio indisponível agora', erro);
    }
    // cada destaque com todas as lojas em que o jogo está em promoção (preço médio + "Escolher loja")
    ativos = await comTodasAsLojas(ativos);
    if (vez !== conferindo) return;
    guardarDestaques(ativos);
    if (!ativos.length) return semDestaques();
    desenharDestaques(ativos);
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    status.textContent = `preços conferidos às ${hora}${encerrados ? ` · ${encerrados} encerrada${encerrados > 1 ? 's' : ''} saiu da lista` : ''}`;
    status.className = 'status-ao-vivo';
  } catch (erro) {
    console.error(erro);
    if (vez !== conferindo) return;
    status.textContent = 'preços da última atualização do admin';
    status.className = 'status-ao-vivo antigo';
  }
}

function carregarDestaques(contextoPronto) {
  const trilho = $('#trilho-destaques');
  const guardados = destaquesGuardados();
  if (guardados?.length) contextoPronto.then(() => desenharDestaques(guardados));
  else trilho.innerHTML = esqueletos(4);

  let primeiraLista = true;
  ouvirDestaques(
    async (lista) => {
      const primeira = primeiraLista;
      primeiraLista = false;
      await contextoPronto; // preços em reais precisam da cotação
      destaquesDoBanco = lista.filter((d) => d.ativo); // pausados no painel não aparecem
      if (!destaquesDoBanco.length) {
        guardarDestaques([]);
        return semDestaques();
      }
      // 1) na primeira vez sem cópia guardada, mostra na hora com os preços salvos…
      if (primeira && !guardados?.length) desenharDestaques(destaquesDoBanco);
      conferirAgora(); // 2) …e os de agora na CheapShark
    },
    (erro) => {
      console.error(erro);
      contextoPronto.then(() => !guardados?.length && semDestaques());
    },
  );

  setInterval(() => document.visibilityState === 'visible' && conferirAgora(), CONFERIR_A_CADA);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && conferirAgora());
}

// "exibir" (definido no painel): 'ambos', só no 'banner' ou só na 'faixa'
let assinaturaDestaques = '';
let chaveFaixa = '';
function desenharDestaques(lista) {
  // assinatura: quais destaques, em que ordem e com que preço; se nada mudou, não mexe na tela
  const assinatura = lista.map((d) => `${d.dealID}:${d.precoPromocional}:${d.exibir}:${d.comentario || ''}`).join('|');
  if (assinatura === assinaturaDestaques) return;
  assinaturaDestaques = assinatura;

  const naFaixa = lista.filter((d) => d.exibir !== 'banner');
  const noBanner = agruparPorJogo(lista.filter((d) => d.exibir !== 'faixa'));
  const itens = agruparPorJogo(naFaixa);
  const trilho = $('#trilho-destaques');
  $('#faixa-destaques').hidden = !itens.length;
  $('#qtd-destaques').textContent = `${itens.length} ${itens.length === 1 ? 'jogo' : 'jogos'}`;

  const chave = itens.map((p) => p.dealID).join('|');
  const html = itens.map((item, i) => cartaoJogo(item, { especial: true, i })).join('');
  if (chave === chaveFaixa) {
    atualizarCartoesNoLugar(trilho, html); // mesmos jogos: só preço/desconto/comentário mudam
  } else if (!chaveFaixa || trilho.querySelector('.esqueleto')) {
    trilho.innerHTML = html; // primeira vez: entra com a animação normal
  } else {
    // a lista mudou: some e reaparece suavemente, sem repetir a entrada cartão a cartão
    const rolagem = trilho.scrollLeft;
    trilho.classList.add('trocando');
    setTimeout(() => {
      trilho.classList.add('sem-animacao');
      trilho.innerHTML = html;
      trilho.scrollLeft = rolagem;
      requestAnimationFrame(() => trilho.classList.remove('trocando'));
    }, 250);
  }
  chaveFaixa = chave;

  if (noBanner.length) renderizarBillboard(noBanner.slice(0, 6));
  else semDestaquesNoBanner();
  estado.destaques = lista;
}

// Troca só as partes que mudaram de cada cartão; a capa (imagem) não é tocada
function atualizarCartoesNoLugar(trilho, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  for (const novo of t.content.querySelectorAll('.jogo')) {
    const atual = trilho.querySelector(`.jogo[data-deal="${CSS.escape(novo.dataset.deal)}"]`);
    if (!atual) continue;
    const corpoNovo = novo.querySelector('.jogo-corpo');
    const corpo = atual.querySelector('.jogo-corpo');
    if (corpo && corpoNovo && corpo.innerHTML !== corpoNovo.innerHTML) corpo.innerHTML = corpoNovo.innerHTML;
    const seloNovo = novo.querySelector('.jogo-capa > .desconto');
    const selo = atual.querySelector('.jogo-capa > .desconto');
    if (selo && seloNovo) selo.outerHTML !== seloNovo.outerHTML && selo.replaceWith(seloNovo);
    else if (selo) selo.remove();
    else if (seloNovo) atual.querySelector('.jogo-capa').append(seloNovo);
  }
}

async function semDestaquesNoBanner() {
  try {
    renderizarBillboard(agruparPorJogo(await comTodasAsLojas(await destaquesAutomaticos(5, { excluir: estado.destaques || [] }))));
  } catch (erro) {
    console.error(erro);
  }
}

// Sem destaques no Firestore: a vitrine se completa sozinha com os melhores da métrica do rodízio,
// do mesmo jeito que os destaques escolhidos (banner e faixa)
async function semDestaques() {
  try {
    const automaticos = await comTodasAsLojas(await destaquesAutomaticos(5));
    if (!automaticos.length) throw new Error('sem promoções para completar');
    guardarDestaques(automaticos);
    desenharDestaques(automaticos);
  } catch (erro) {
    console.error(erro);
    $('#faixa-destaques').hidden = true;
  }
}

function blocoLoja(lojaId, lista) {
  atualizarAtalhoDaLoja(lojaId, lista);
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
// Barra das lojas: um bloco por loja, com a cor dela; o "até -X%" aparece quando a faixa da loja carrega
const NOME_CURTO = { 'Epic Games Store': 'Epic Games', GreenManGaming: 'Green Man Gaming', 'Humble Store': 'Humble' };
function renderizarAtalhos() {
  const nav = $('#atalhos-lojas');
  nav.innerHTML =
    ORDEM_LOJAS.filter((id) => contexto.lojas.has(id))
      .slice(0, 12)
      .map((id) => {
        const l = contexto.lojas.get(id);
        return `
        <a class="loja-atalho" data-loja-atalho="${esc(id)}" href="/loja.html?id=${encodeURIComponent(id)}" style="${varsDaLoja(id)}">
          <span class="loja-atalho-icone"><img src="${esc(l.icone)}" alt="" loading="lazy" /></span>
          <span class="loja-atalho-texto"><strong>${esc(NOME_CURTO[l.nome] || l.nome)}</strong><small>ver ofertas</small></span>
        </a>`;
      })
      .join('') +
    `<a class="loja-atalho especial gratis" href="#faixa-gratis">
       <span class="loja-atalho-icone">🎁</span><span class="loja-atalho-texto"><strong>Grátis</strong><small>para resgatar</small></span>
     </a>
     <a class="loja-atalho especial" href="/jogos.html">
       <span class="loja-atalho-icone">⭐</span><span class="loja-atalho-texto"><strong>Games</strong><small>todos os jogos</small></span>
     </a>`;
  // esmaecido nas bordas só do lado em que ainda dá para rolar
  const bordas = () => {
    nav.classList.toggle('tem-esquerda', nav.scrollLeft > 4);
    nav.classList.toggle('tem-direita', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4);
  };
  nav.addEventListener('scroll', bordas, { passive: true });
  addEventListener('resize', bordas);
  bordas();
}

function atualizarAtalhoDaLoja(lojaId, lista) {
  const el = document.querySelector(`[data-loja-atalho="${CSS.escape(String(lojaId))}"] small`);
  const maior = Math.max(0, ...lista.map((p) => p.desconto || 0));
  if (el && maior) el.textContent = `até -${maior}%`;
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
  const contextoPronto = carregarContexto();
  carregarDestaques(contextoPronto); // começa já, em paralelo com a cotação e as lojas
  await contextoPronto;
  $('#cotacao').innerHTML = contexto.cotacao ? `Dólar: <strong>${formatarReal(contexto.cotacao)}</strong>` : 'Preços em dólar';
  estado.lojasPendentes = ORDEM_LOJAS.filter((id) => contexto.lojas.has(id));
  renderizarAtalhos();
  carregarGratis();
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
