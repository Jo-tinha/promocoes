// Peças visuais compartilhadas: cartão de jogo, pílula da loja, metadados, preços e esqueletos
import { contexto, precoEmReal } from './contexto.js';
import { varsDaLoja, lojaPelaPlataforma, imgJogo } from './lojas.js';
import { botaoEstrela } from './estrela.js';
import { esc } from './util.js';

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
  return itens.length ? `<div class="metas">${itens.join('')}</div>` : '';
}

export function precos(p) {
  const gratis = p.precoPromocional === 0;
  return `<div class="precos">
    ${p.precoNormal > 0 ? `<span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>` : ''}
    <span class="preco-final">${gratis ? 'Grátis' : precoEmReal(p.precoPromocional)}</span>
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
