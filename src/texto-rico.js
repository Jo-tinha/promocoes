// Comentário com formatação (destaques): um pequeno editor com títulos H1–H3, negrito, itálico,
// sublinhado, riscado, marca-texto e lista. O texto é guardado num formato simples (parecido com
// Markdown) e convertido em HTML seguro na hora de mostrar — nada de HTML vindo do campo.
//
//   # Título grande      ## Título médio      ### Título pequeno      - item de lista
//   **negrito**   *itálico*   __sublinhado__   ~~riscado~~   ==marca-texto==

import { esc } from './util.js';

export const LIMITE_COMENTARIO = 300;

function inline(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
}

// texto → HTML seguro. modo 'cartao' (compacto) ou 'banner'
export function renderizarComentario(texto = '') {
  const linhas = esc(String(texto).slice(0, LIMITE_COMENTARIO)).split(/\r?\n/);
  const partes = [];
  let lista = [];
  let paragrafo = [];
  const fecharLista = () => {
    if (lista.length) partes.push(`<ul>${lista.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
    lista = [];
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) partes.push(`<p>${paragrafo.map(inline).join('<br />')}</p>`);
    paragrafo = [];
  };
  for (const bruta of linhas) {
    const linha = bruta.trimEnd();
    const titulo = linha.match(/^(#{1,3})\s+(.*)$/);
    const item = linha.match(/^[-•]\s+(.*)$/);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      const n = titulo[1].length;
      partes.push(`<h${n + 2} class="c-h${n}">${inline(titulo[2])}</h${n + 2}>`); // h3–h5 na página (o h1/h2 da página continuam únicos)
    } else if (item) {
      fecharParagrafo();
      lista.push(item[1]);
    } else if (!linha.trim()) {
      fecharParagrafo();
      fecharLista();
    } else {
      fecharLista();
      paragrafo.push(linha);
    }
  }
  fecharParagrafo();
  fecharLista();
  return partes.join('');
}

// Versão sem formatação (listas no painel, títulos de cartão etc.)
export function textoSimples(texto = '') {
  return String(texto)
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^[-•]\s+/gm, '• ')
    .replace(/\*\*|__|~~|==/g, '')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2')
    .replace(/\s*\n+\s*/g, ' · ')
    .trim();
}

// ---------- Editor ----------
const BOTOES = [
  { acao: 'h1', rotulo: 'H1', titulo: 'Título grande' },
  { acao: 'h2', rotulo: 'H2', titulo: 'Título médio' },
  { acao: 'h3', rotulo: 'H3', titulo: 'Título pequeno' },
  { acao: 'p', rotulo: '¶', titulo: 'Texto normal' },
  { sep: true },
  { acao: 'negrito', rotulo: '<b>B</b>', titulo: 'Negrito (Ctrl+B)' },
  { acao: 'italico', rotulo: '<i>I</i>', titulo: 'Itálico (Ctrl+I)' },
  { acao: 'sublinhado', rotulo: '<u>U</u>', titulo: 'Sublinhado (Ctrl+U)' },
  { acao: 'riscado', rotulo: '<s>S</s>', titulo: 'Riscado' },
  { acao: 'marca', rotulo: '<mark>M</mark>', titulo: 'Marca-texto' },
  { sep: true },
  { acao: 'lista', rotulo: '• Lista', titulo: 'Lista com marcadores' },
  { sep: true },
  { emoji: '🔥' },
  { emoji: '💰' },
  { emoji: '⭐' },
  { emoji: '🎮' },
  { emoji: '⏳' },
  { emoji: '🏆' },
  { sep: true },
  { acao: 'limpar', rotulo: 'Limpar', titulo: 'Tirar a formatação' },
];

const MARCAS = { negrito: '**', italico: '*', sublinhado: '__', riscado: '~~', marca: '==' };

export function editorComentario({ nome = 'comentario', valor = '', placeholder = 'Ex.: Menor preço do ano!' } = {}) {
  return `
    <div class="editor-comentario" data-editor>
      <div class="editor-barra" role="toolbar" aria-label="Formatação">
        ${BOTOES.map((b) =>
          b.sep
            ? '<span class="editor-sep" aria-hidden="true"></span>'
            : b.emoji
              ? `<button type="button" class="editor-botao" data-emoji="${b.emoji}" title="Inserir ${b.emoji}">${b.emoji}</button>`
              : `<button type="button" class="editor-botao" data-acao="${b.acao}" title="${b.titulo}" aria-label="${b.titulo}">${b.rotulo}</button>`,
        ).join('')}
      </div>
      <textarea name="${nome}" rows="4" maxlength="${LIMITE_COMENTARIO}" placeholder="${esc(placeholder)}">${esc(valor)}</textarea>
      <div class="editor-rodape">
        <small>Atalhos: Ctrl+B, Ctrl+I, Ctrl+U · uma linha começando com # vira título</small>
        <small data-contador></small>
      </div>
      <div class="editor-previas">
        <div><span class="editor-previa-rotulo">No cartão</span><div class="editor-previa-cartao comentario-dedo comentario-rico" data-previa-cartao></div></div>
        <div><span class="editor-previa-rotulo">No banner</span><div class="editor-previa-banner billboard-comentario comentario-rico" data-previa-banner></div></div>
      </div>
    </div>`;
}

function linhasSelecionadas(t) {
  const v = t.value;
  const ini = v.lastIndexOf('\n', t.selectionStart - 1) + 1;
  let fim = v.indexOf('\n', t.selectionEnd);
  if (fim < 0) fim = v.length;
  return { ini, fim, texto: v.slice(ini, fim) };
}

function trocar(t, ini, fim, novo, selIni, selFim) {
  t.setRangeText(novo, ini, fim, 'end');
  if (selIni !== undefined) t.setSelectionRange(selIni, selFim);
  t.dispatchEvent(new Event('input', { bubbles: true }));
  t.focus();
}

function aplicar(t, acao) {
  const { selectionStart: a, selectionEnd: b, value: v } = t;
  if (MARCAS[acao]) {
    const m = MARCAS[acao];
    const sel = v.slice(a, b);
    // já está marcado? tira a marcação
    if (v.slice(a - m.length, a) === m && v.slice(b, b + m.length) === m) {
      return trocar(t, a - m.length, b + m.length, sel, a - m.length, b - m.length);
    }
    const texto = sel || 'texto';
    return trocar(t, a, b, `${m}${texto}${m}`, a + m.length, a + m.length + texto.length);
  }
  const { ini, fim, texto } = linhasSelecionadas(t);
  const semPrefixo = (l) => l.replace(/^(#{1,3}\s+|[-•]\s+)/, '');
  let novo;
  if (acao === 'limpar') novo = texto.split('\n').map((l) => semPrefixo(l).replace(/\*\*|__|~~|==|\*/g, '')).join('\n');
  else if (acao === 'p') novo = texto.split('\n').map(semPrefixo).join('\n');
  else if (acao === 'lista') {
    const todas = texto.split('\n').every((l) => /^[-•]\s+/.test(l));
    novo = texto.split('\n').map((l) => (todas ? semPrefixo(l) : `- ${semPrefixo(l)}`)).join('\n');
  } else {
    const prefixo = { h1: '# ', h2: '## ', h3: '### ' }[acao];
    novo = texto.split('\n').map((l) => `${prefixo}${semPrefixo(l)}`).join('\n');
  }
  trocar(t, ini, fim, novo, ini, ini + novo.length);
}

// Liga os editores dentro de "raiz"
export function ativarEditores(raiz, aoMudar = () => {}) {
  for (const ed of raiz.querySelectorAll('[data-editor]')) {
    if (ed.dataset.ativo) continue;
    ed.dataset.ativo = '1';
    const t = ed.querySelector('textarea');
    const contador = ed.querySelector('[data-contador]');
    const atualizar = () => {
      const html = renderizarComentario(t.value) || '<p class="editor-vazio">O comentário aparece aqui.</p>';
      ed.querySelector('[data-previa-cartao]').innerHTML = html;
      ed.querySelector('[data-previa-banner]').innerHTML = html;
      contador.textContent = `${t.value.length}/${LIMITE_COMENTARIO}`;
      contador.classList.toggle('perto', t.value.length > LIMITE_COMENTARIO * 0.9);
      aoMudar();
    };
    ed.querySelector('.editor-barra').addEventListener('mousedown', (e) => e.preventDefault()); // não perde a seleção
    ed.querySelector('.editor-barra').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.emoji) return trocar(t, t.selectionStart, t.selectionEnd, b.dataset.emoji);
      aplicar(t, b.dataset.acao);
    });
    t.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const acao = { b: 'negrito', i: 'italico', u: 'sublinhado' }[e.key.toLowerCase()];
      if (acao) {
        e.preventDefault();
        aplicar(t, acao);
      }
    });
    t.addEventListener('input', atualizar);
    ed.atualizarEditor = atualizar;
    atualizar();
  }
}

// Janela só do comentário (substitui o prompt() do navegador). Devolve o texto ou null (cancelou).
export function abrirEditorComentario({ titulo = '', valor = '' } = {}) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo-destacar dialogo-comentario';
    dialogo.innerHTML = `
      <form method="dialog" class="destacar-conteudo" novalidate>
        <header class="destacar-topo">
          <div><span class="selo-tipo">Comentário do destaque</span><h2>${esc(titulo)}</h2>
            <p class="secao-nota" style="margin:4px 0 0">Aparece no cartão e no banner da vitrine.</p></div>
          <button class="escolha-fechar" type="button" data-cancelar aria-label="Fechar">×</button>
        </header>
        ${editorComentario({ valor })}
        <footer class="form-acoes">
          <button class="botao secundario" type="button" data-cancelar>Cancelar</button>
          <button class="botao" type="submit">Salvar comentário</button>
        </footer>
      </form>`;
    document.body.append(dialogo);
    const fechar = (r) => {
      dialogo.close();
      dialogo.remove();
      resolver(r);
    };
    dialogo.addEventListener('cancel', (e) => {
      e.preventDefault();
      fechar(null);
    });
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-cancelar]')) fechar(null);
    });
    dialogo.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      fechar(dialogo.querySelector('textarea').value.trim());
    });
    ativarEditores(dialogo);
    dialogo.showModal();
    const t = dialogo.querySelector('textarea');
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  });
}
