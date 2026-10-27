// Peças visuais compartilhadas: cartão de jogo, pílula da loja, metadados, preços e esqueletos
import { contexto, precoEmReal } from './contexto.js';
import { varsDaLoja, lojaPelaPlataforma, imgJogo } from './lojas.js';
import { botaoEstrela } from './estrela.js';
import { esc, formatarReal } from './util.js';

export function pilulaLoja(lojaId, textoAlternativo = '') {
  const loja = contexto.lojas.get(lojaId);
  const nome = loja?.nome || textoAlternativo || 'Loja';
  return `<span class="pilula-loja" style="${varsDaLoja(lojaId)}">
    ${loja ? `<img src="${esc(loja.icone)}" alt="" />` : ''}${esc(nome)}</span>`;
}

export function metas(p) {
  const itens = [];
  if (p.avaliacaoPct) itens.push(`<span class="meta${p.avaliacaoPct >= 80 ? ' bom' : ''}" title="${esc(p.avaliacao)} na Steam">👍 ${p.avaliacaoPct}%</span>`);
  if (p.metacritic) itens.push(`<span class="meta mc" title="Nota no Metacritic">MC ${p.metacritic}</span>`);
  if (p.lancamento) itens.push(`<span class="meta">${p.lancamento.getFullYear()}</span>`);
  if (p.termina) itens.push(`<span class="meta">até ${p.termina.toLocaleDateString('pt-BR')}</span>`);
  if (p.precoMudou) itens.push('<span class="meta preco-mudou" title="O preço mudou desde que o jogo foi destacado">preço atualizado</span>');
  return itens.length ? `<div class="metas">${itens.join('')}</div>` : '';
}

// destaques manuais guardam o preço em reais; os da API, em dólar
const valor = (p, v) => (p.moeda === 'BRL' ? formatarReal(v) : precoEmReal(v));

export function precos(p) {
  if (p.precoPromocional === null || p.precoPromocional === undefined) return ''; // banner sem preço (evento, anúncio)
  const gratis = p.precoPromocional === 0;
  return `<div class="precos">
    ${p.precoNormal > p.precoPromocional ? `<span class="preco-antigo">${valor(p, p.precoNormal)}</span>` : ''}
    <span class="preco-final">${gratis ? 'Grátis' : valor(p, p.precoPromocional)}</span>
  </div>`;
}

// especial = lista que mistura lojas (Destaques, Grátis, Busca, Games): mostra a logo da loja pequena no topo
export function cartaoJogo(p, { especial = false, i = 0 } = {}) {
  const lojaId = p.lojaId || lojaPelaPlataforma(p.plataformas);
  const gratis = p.precoPromocional === 0;
  return `
    <article class="jogo" data-deal="${esc(p.dealID)}" style="${varsDaLoja(lojaId)};--i:${Math.min(i, 20)}">
      <a class="jogo-capa" href="${esc(p.link)}" target="_blank" rel="noopener sponsored" tabindex="-1">
        ${imgJogo(p)}
        ${especial ? pilulaLoja(lojaId, p.lojaNome || p.plataformas) : ''}
        ${p.desconto >= 1 ? `<span class="desconto${gratis ? ' gratis' : ''}">${gratis ? 'GRÁTIS' : `-${p.desconto}%`}</span>` : ''}
      </a>
      <div class="jogo-corpo">
        <h3 title="${esc(p.titulo)}">${esc(p.titulo)}</h3>
        ${p.comentario ? `<p class="comentario-dedo">“${esc(p.comentario)}”</p>` : ''}
        ${metas(p)}
        ${precos(p)}
        <div class="jogo-rodape">
          <a href="${esc(p.link)}" target="_blank" rel="noopener sponsored">${esc(p.textoBotao || (gratis ? 'Resgatar' : 'Ver na loja'))} →</a>
          ${botaoEstrela(p)}
        </div>
      </div>
    </article>`;
}

export const esqueletos = (n, bloco = false) =>
  (bloco ? '<div class="esqueleto bloco"></div>' : '') + Array.from({ length: n }, () => '<div class="esqueleto"></div>').join('');

export const setas =
  '<button class="seta esq" type="button" aria-label="Rolar para a esquerda">‹</button><button class="seta dir" type="button" aria-label="Rolar para a direita">›</button>';

// Setas das faixas horizontais (um ouvinte por página)
export function ativarSetas() {
  document.addEventListener('click', (e) => {
    const seta = e.target.closest('.seta');
    if (!seta) return;
    const trilho = seta.parentElement.querySelector('.trilho');
    trilho.scrollBy({ left: (seta.classList.contains('dir') ? 1 : -1) * trilho.clientWidth * 0.85 });
  });
}

// Redesenha as estrelas depois do login (o estado das estrelas muda)
export function redesenharEstrelas(buscarPromo) {
  document.querySelectorAll('.jogo[data-deal]').forEach((cartao) => {
    const rodape = cartao.querySelector('.jogo-rodape');
    const p = buscarPromo(cartao.dataset.deal);
    if (!rodape || !p) return;
    rodape.querySelector('[data-estrela]')?.remove();
    rodape.insertAdjacentHTML('beforeend', botaoEstrela(p));
  });
}

// ---------- Jogo em várias lojas: um cartão só ----------
const chaveDoJogo = (p) => (p.manual ? p.dealID : p.gameID) || String(p.titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Junta as promoções do mesmo jogo, mantendo a ordem em que cada jogo apareceu primeiro.
// Devolve itens normais (1 loja) e grupos { agrupado: true, ofertas: [...] } (2+ lojas).
export function agruparPorJogo(lista) {
  const grupos = new Map();
  for (const p of lista) {
    const k = chaveDoJogo(p);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  return [...grupos.values()].map((ofertas) => {
    if (ofertas.length === 1) return ofertas[0];
    const base = ofertas[0];
    const precosPromo = ofertas.map((o) => o.precoPromocional);
    const precosNormais = ofertas.map((o) => o.precoNormal);
    const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    return {
      ...base,
      agrupado: true,
      ofertas,
      dealID: `grupo-${chaveDoJogo(base)}`,
      precoMedio: media(precosPromo),
      precoNormalMedio: media(precosNormais),
      menorPreco: Math.min(...precosPromo),
      maiorDesconto: Math.max(...ofertas.map((o) => o.desconto)),
      comentario: ofertas.map((o) => o.comentario).find(Boolean) || '',
    };
  });
}

function logosDasLojas(ofertas) {
  const ids = [...new Set(ofertas.map((o) => o.lojaId))];
  const visiveis = ids.slice(0, 4);
  return `<span class="logos-lojas" title="${esc(ids.map((id) => contexto.lojas.get(id)?.nome || 'Loja').join(', '))}">
    ${visiveis.map((id) => `<img src="${esc(contexto.lojas.get(id)?.icone || '')}" alt="" style="${varsDaLoja(id)}" />`).join('')}
    ${ids.length > 4 ? `<span>+${ids.length - 4}</span>` : ''}
    <em>${ids.length} lojas</em>
  </span>`;
}

export function cartaoAgrupado(g, { i = 0 } = {}) {
  return `
    <article class="jogo jogo-agrupado" data-deal="${esc(g.dealID)}" data-escolher="${esc(g.dealID)}" style="--i:${Math.min(i, 20)}">
      <button class="jogo-capa" type="button" data-escolher="${esc(g.dealID)}" tabindex="-1" aria-hidden="true">
        ${imgJogo(g)}
        ${logosDasLojas(g.ofertas)}
        ${g.maiorDesconto >= 1 ? `<span class="desconto">até -${g.maiorDesconto}%</span>` : ''}
      </button>
      <div class="jogo-corpo">
        <h3 title="${esc(g.titulo)}">${esc(g.titulo)}</h3>
        ${g.comentario ? `<p class="comentario-dedo">“${esc(g.comentario)}”</p>` : ''}
        ${metas(g)}
        <div class="precos">
          <span class="preco-legenda">média</span>
          <span class="preco-final">${precoEmReal(g.precoMedio)}</span>
          <span class="preco-de">a partir de ${precoEmReal(g.menorPreco)}</span>
        </div>
        <div class="jogo-rodape">
          <button class="link-escolher" type="button" data-escolher="${esc(g.dealID)}">Escolher loja (${g.ofertas.length}) →</button>
          ${botaoEstrela(g)}
        </div>
      </div>
    </article>`;
}

// cartão certo para cada item (normal ou agrupado)
export const cartaoItem = (item, opcoes) => (item.agrupado ? cartaoAgrupado(item, opcoes) : cartaoJogo(item, opcoes));
