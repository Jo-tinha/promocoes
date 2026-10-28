// Campo de imagem do painel: mostra a resolução ideal, a prévia no formato em que a imagem aparece
// no site, a resolução real da imagem escolhida (com aviso se estiver baixa ou fora da proporção)
// e sugestões prontas da Steam em alta resolução.
import { idSteam } from './lojas.js';
import { esc } from './util.js';

const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

export const IDEAL = {
  cartao: {
    rotulo: 'Imagem do cartão',
    onde: 'faixas de destaques e de lojas',
    largura: 920,
    altura: 430,
    minLargura: 460,
    minAltura: 215,
    proporcao: 920 / 430, // 2,14 : 1 (o mesmo formato do "header" da Steam)
  },
  banner: {
    rotulo: 'Imagem do banner',
    onde: 'banner grande no topo da vitrine',
    largura: 1920,
    altura: 620,
    minLargura: 1280,
    minAltura: 413,
    proporcao: 1920 / 620, // 3,1 : 1 (o mesmo formato do "library hero" da Steam)
  },
};

const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// Sugestões da Steam (quando o jogo tem página lá), da maior para a menor
export function sugestoesSteam(p, tipo) {
  const id = idSteam(p);
  if (!id) return [];
  const base = `${STEAM}/${id}`;
  return tipo === 'banner'
    ? [
        { rotulo: 'Arte larga (library hero) · 3840×1240', url: `${base}/library_hero.jpg` },
        { rotulo: 'Capa média · 616×353', url: `${base}/capsule_616x353.jpg` },
      ]
    : [
        { rotulo: 'Capa média · 616×353', url: `${base}/capsule_616x353.jpg` },
        { rotulo: 'Capa da loja (header) · 460×215', url: `${base}/header.jpg` },
        { rotulo: 'Arte larga (library hero) · 3840×1240', url: `${base}/library_hero.jpg` },
      ];
}

// Carrega a imagem e diz se serve: { nivel: 'ok' | 'aviso' | 'erro', texto, largura, altura }
export function analisarImagem(url, tipo) {
  const ideal = IDEAL[tipo];
  return new Promise((resolver) => {
    if (!url) return resolver({ nivel: '', texto: '' });
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const proporcao = w / h;
      const diferenca = Math.abs(proporcao - ideal.proporcao) / ideal.proporcao;
      const partes = [`${w} × ${h} px`];
      let nivel = 'ok';
      if (w < ideal.minLargura || h < ideal.minAltura) {
        nivel = 'erro';
        partes.push(`resolução baixa: vai ficar borrada (mínimo ${ideal.minLargura} × ${ideal.minAltura})`);
      } else if (w < ideal.largura) {
        nivel = 'aviso';
        partes.push(`aceitável, mas o ideal é ${ideal.largura} × ${ideal.altura}`);
      } else partes.push('boa resolução');
      if (diferenca > 0.25) {
        if (nivel === 'ok') nivel = 'aviso';
        partes.push(
          `proporção ${fmt(proporcao)} : 1 (o ideal é ${fmt(ideal.proporcao)} : 1) — as bordas ${proporcao > ideal.proporcao ? 'dos lados' : 'de cima e de baixo'} vão ser cortadas; confira na prévia`,
        );
      }
      resolver({ nivel, texto: partes.join(' · '), largura: w, altura: h });
    };
    img.onerror = () => resolver({ nivel: 'erro', texto: 'Não foi possível abrir essa imagem. Confira se o link termina em .jpg, .png ou .webp e é público.' });
    img.src = url;
  });
}

// Primeira imagem da lista que abre de verdade (a automática pode ter alternativas que não existem)
async function primeiraQueAbre(lista, tipo) {
  for (const url of lista) {
    const r = await analisarImagem(url, tipo);
    if (!/abrir/.test(r.texto)) return { url, r };
  }
  return { url: '', r: { nivel: '', texto: 'Sem imagem automática para este jogo — escolha uma.' } };
}

// HTML do campo. "automatica" = lista de imagens usadas quando o campo fica vazio (só para a prévia)
export function campoImagem({ nome, tipo, valor = '', automatica = [], jogo = null, obrigatorio = false }) {
  automatica = [].concat(automatica).filter(Boolean).join('|');
  const ideal = IDEAL[tipo];
  const sugestoes = jogo ? sugestoesSteam(jogo, tipo) : [];
  return `
    <div class="campo-imagem" data-campo-imagem="${tipo}" data-automatica="${esc(automatica)}">
      <div class="campo-imagem-texto">
        <strong>${ideal.rotulo}</strong> <small>— ${ideal.onde}</small>
        <p class="resolucao-ideal">
          📐 Resolução ideal: <b>${ideal.largura} × ${ideal.altura} px</b> (proporção ${fmt(ideal.proporcao)} : 1) ·
          mínimo ${ideal.minLargura} × ${ideal.minAltura} px · JPG, PNG ou WebP
        </p>
        <input name="${nome}" type="url" value="${esc(valor)}" ${obrigatorio ? 'required' : ''}
               placeholder="${automatica ? 'Vazio = imagem automática (a da prévia)' : 'https://… (link direto da imagem)'}" />
        ${
          sugestoes.length
            ? `<div class="sugestoes-imagem"><span>Sugestões da Steam:</span>${sugestoes
                .map((s) => `<button type="button" class="chip" data-sugestao="${esc(s.url)}">${esc(s.rotulo)}</button>`)
                .join('')}${automatica ? '<button type="button" class="chip" data-sugestao="">Automática</button>' : ''}</div>`
            : ''
        }
        <p class="situacao-imagem" data-situacao role="status"></p>
      </div>
      <div class="previa-imagem previa-tipo-${tipo}" style="aspect-ratio:${ideal.largura} / ${ideal.altura}" title="Prévia do recorte como aparece no site">
        <img alt="" data-previa hidden />
        <span class="previa-vazia" data-vazia>sem imagem</span>
        <span class="previa-medida">${ideal.largura}×${ideal.altura}</span>
      </div>
    </div>`;
}

// Liga os campos de imagem dentro de "raiz": prévia, análise e sugestões. aoMudar() é chamado a cada troca.
export function ativarCamposImagem(raiz, aoMudar = () => {}) {
  for (const campo of raiz.querySelectorAll('[data-campo-imagem]')) {
    if (campo.dataset.ativo) continue;
    campo.dataset.ativo = '1';
    const tipo = campo.dataset.campoImagem;
    const input = campo.querySelector('input');
    const previa = campo.querySelector('[data-previa]');
    const vazia = campo.querySelector('[data-vazia]');
    const situacao = campo.querySelector('[data-situacao]');
    let vez = 0;
    const atualizar = async () => {
      const proprio = input.value.trim();
      const automaticas = (campo.dataset.automatica || '').split('|').filter(Boolean);
      const minha = ++vez;
      campo.querySelectorAll('[data-sugestao]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sugestao === proprio)));
      if (!proprio && !automaticas.length) {
        previa.hidden = true;
        vazia.hidden = false;
        situacao.textContent = '';
        situacao.className = 'situacao-imagem';
        return aoMudar();
      }
      situacao.textContent = 'Conferindo a imagem…';
      situacao.className = 'situacao-imagem';
      const { url, r } = proprio ? { url: proprio, r: await analisarImagem(proprio, tipo) } : await primeiraQueAbre(automaticas, tipo);
      if (minha !== vez) return;
      previa.hidden = !url;
      vazia.hidden = Boolean(url);
      if (url) previa.src = url;
      const icone = { ok: '✓', aviso: '⚠', erro: '✕' }[r.nivel] || '';
      situacao.textContent = `${icone} ${proprio ? '' : 'Automática: '}${r.texto}`;
      situacao.className = `situacao-imagem nivel-${r.nivel}`;
      campo.dataset.nivel = r.nivel;
      aoMudar();
    };
    let espera;
    input.addEventListener('input', () => {
      clearTimeout(espera);
      espera = setTimeout(atualizar, 350);
    });
    campo.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sugestao]');
      if (!s) return;
      input.value = s.dataset.sugestao;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      atualizar();
    });
    campo.atualizarImagem = atualizar;
    atualizar();
  }
}

// Algum campo com imagem que não abre? (resolução baixa só avisa, não bloqueia)
export function imagemComErro(raiz) {
  return [...raiz.querySelectorAll('[data-campo-imagem]')].some((c) => c.querySelector('input').value.trim() && c.dataset.nivel === 'erro' && /abrir/.test(c.querySelector('[data-situacao]').textContent));
}
