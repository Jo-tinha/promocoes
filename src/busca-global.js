// Barra de busca do cabeçalho (todas as páginas): sugestões enquanto digita, teclado, recentes e atalho "/"
import { buscarJogosPorNome } from './api.js';
import { carregarContexto, precoEmReal } from './contexto.js';
import { guardarPreferencia, lerPreferencia } from './site.js';
import { esc } from './util.js';

const MAX_RECENTES = 6;
const ICONE_LUPA =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>';

const cache = new Map(); // termo → sugestões (evita repetir a mesma consulta)

const urlBusca = (termo) => `/busca.html?q=${encodeURIComponent(termo)}`;
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Destaca o trecho digitado dentro do título
function destacar(titulo, termo) {
  const i = normalizar(titulo).indexOf(normalizar(termo));
  if (!termo || i < 0) return esc(titulo);
  return `${esc(titulo.slice(0, i))}<mark>${esc(titulo.slice(i, i + termo.length))}</mark>${esc(titulo.slice(i + termo.length))}`;
}

function lerRecentes() {
  return lerPreferencia('buscas-recentes') || [];
}
function salvarRecente(termo) {
  const t = termo.trim();
  if (!t) return;
  const lista = [t, ...lerRecentes().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENTES);
  guardarPreferencia('buscas-recentes', lista); // só guarda se o usuário permitiu "Preferências" nos cookies
}
function removerRecente(termo) {
  guardarPreferencia('buscas-recentes', lerRecentes().filter((r) => r !== termo));
}

export function iniciarBusca(alvo) {
  const termoAtual = new URLSearchParams(location.search).get('q') || '';
  alvo.innerHTML = `
    <form class="busca" role="search" action="/busca.html" autocomplete="off">
      <button class="busca-abrir" type="button" aria-label="Abrir busca">${ICONE_LUPA}</button>
      <div class="busca-caixa">
        <button class="busca-voltar" type="button" aria-label="Fechar busca">←</button>
        <span class="busca-icone">${ICONE_LUPA}</span>
        <input class="busca-campo" type="search" name="q" value="${esc(location.pathname.startsWith('/busca') ? termoAtual : '')}"
               placeholder="Buscar jogos em todas as lojas" aria-label="Buscar jogos"
               role="combobox" aria-expanded="false" aria-controls="busca-lista" aria-autocomplete="list" enterkeyhint="search" />
        <span class="busca-carregando" hidden aria-hidden="true"></span>
        <button class="busca-limpar" type="button" aria-label="Limpar busca" hidden>×</button>
        <kbd class="busca-atalho" title="Atalho: tecla /">/</kbd>
        <div class="busca-painel" id="busca-lista" role="listbox" hidden></div>
      </div>
    </form>`;

  const form = alvo.querySelector('.busca');
  const campo = alvo.querySelector('.busca-campo');
  const painel = alvo.querySelector('.busca-painel');
  const carregando = alvo.querySelector('.busca-carregando');
  const limpar = alvo.querySelector('.busca-limpar');
  let itens = []; // opções navegáveis: { href, termo }
  let ativo = -1;
  let controlador;
  let espera;

  const atualizarLimpar = () => (limpar.hidden = !campo.value);
  atualizarLimpar();

  function abrirPainel(html) {
    painel.innerHTML = html;
    painel.hidden = !html;
    campo.setAttribute('aria-expanded', String(Boolean(html)));
    itens = [...painel.querySelectorAll('[data-opcao]')];
    ativo = -1;
  }
  function fecharPainel() {
    abrirPainel('');
    campo.removeAttribute('aria-activedescendant');
  }

  function marcarAtivo(n) {
    itens.forEach((el) => el.setAttribute('aria-selected', 'false'));
    ativo = n;
    if (n < 0 || !itens[n]) return campo.removeAttribute('aria-activedescendant');
    itens[n].setAttribute('aria-selected', 'true');
    campo.setAttribute('aria-activedescendant', itens[n].id);
    itens[n].scrollIntoView({ block: 'nearest' });
  }

  function mostrarRecentes() {
    const recentes = lerRecentes();
    if (!recentes.length) return fecharPainel();
    abrirPainel(`
      <div class="busca-grupo"><span>Buscas recentes</span><button type="button" class="busca-link" data-limpar-historico>Limpar</button></div>
      ${recentes
        .map(
          (r, i) => `
        <a class="busca-opcao recente" id="busca-op-${i}" role="option" data-opcao data-termo="${esc(r)}" href="${urlBusca(r)}">
          <span class="busca-relogio" aria-hidden="true">↺</span><span class="busca-titulo">${esc(r)}</span>
          <button type="button" class="busca-remover" data-remover="${esc(r)}" aria-label="Remover ${esc(r)} das recentes">×</button>
        </a>`,
        )
        .join('')}`);
  }

  async function sugerir(termo) {
    controlador?.abort();
    controlador = new AbortController();
    carregando.hidden = false;
    try {
      let lista = cache.get(termo.toLowerCase());
      if (!lista) {
        [lista] = await Promise.all([buscarJogosPorNome(termo, { limite: 8, sinal: controlador.signal }), carregarContexto()]);
        cache.set(termo.toLowerCase(), lista);
      }
      if (campo.value.trim() !== termo) return; // o usuário já digitou outra coisa
      const opcoes = lista
        .map(
          (j, i) => `
          <a class="busca-opcao" id="busca-op-${i}" role="option" data-opcao data-termo="${esc(j.titulo)}" href="${urlBusca(j.titulo)}">
            <img src="${esc(j.imagem)}" alt="" loading="lazy" />
            <span class="busca-titulo">${destacar(j.titulo, termo)}</span>
            <span class="busca-preco">${j.menorPreco === 0 ? 'Grátis' : `a partir de <strong>${precoEmReal(j.menorPreco)}</strong>`}</span>
          </a>`,
        )
        .join('');
      abrirPainel(`
        ${lista.length ? `<div class="busca-grupo"><span>Jogos</span></div>${opcoes}` : `<p class="busca-vazio">Nenhum jogo com “${esc(termo)}”. Confira a grafia ou tente o nome em inglês.</p>`}
        <a class="busca-opcao busca-todos" id="busca-op-todos" role="option" data-opcao data-termo="${esc(termo)}" href="${urlBusca(termo)}">
          ${ICONE_LUPA}<span>Ver todos os resultados para “<strong>${esc(termo)}</strong>”</span><kbd>Enter</kbd>
        </a>`);
    } catch (erro) {
      if (erro.name !== 'AbortError') {
        console.error(erro);
        abrirPainel(`<p class="busca-vazio">Não foi possível carregar sugestões. Pressione Enter para buscar mesmo assim.</p>`);
      }
    } finally {
      carregando.hidden = true;
    }
  }

  campo.addEventListener('input', () => {
    atualizarLimpar();
    clearTimeout(espera);
    const termo = campo.value.trim();
    if (termo.length < 2) {
      controlador?.abort();
      carregando.hidden = true;
      return termo ? fecharPainel() : mostrarRecentes();
    }
    espera = setTimeout(() => sugerir(termo), 220);
  });

  campo.addEventListener('focus', () => {
    if (!campo.value.trim()) mostrarRecentes();
    else if (campo.value.trim().length >= 2) sugerir(campo.value.trim());
  });

  campo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && itens.length) {
      e.preventDefault();
      marcarAtivo((ativo + 1) % itens.length);
    } else if (e.key === 'ArrowUp' && itens.length) {
      e.preventDefault();
      marcarAtivo(ativo <= 0 ? itens.length - 1 : ativo - 1);
    } else if (e.key === 'Escape') {
      if (!painel.hidden) fecharPainel();
      else {
        campo.blur();
        form.classList.remove('aberta');
      }
    } else if (e.key === 'Enter' && ativo >= 0 && itens[ativo]) {
      e.preventDefault();
      salvarRecente(itens[ativo].dataset.termo);
      location.href = itens[ativo].href;
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const termo = campo.value.trim();
    if (!termo) return campo.focus();
    salvarRecente(termo);
    location.href = urlBusca(termo);
  });

  painel.addEventListener('mousedown', (e) => e.preventDefault()); // não perde o foco ao clicar
  painel.addEventListener('click', (e) => {
    const remover = e.target.closest('[data-remover]');
    if (remover) {
      e.preventDefault();
      removerRecente(remover.dataset.remover);
      return mostrarRecentes();
    }
    if (e.target.closest('[data-limpar-historico]')) {
      guardarPreferencia('buscas-recentes', []);
      return fecharPainel();
    }
    const opcao = e.target.closest('[data-opcao]');
    if (opcao) salvarRecente(opcao.dataset.termo);
  });
  painel.addEventListener('mousemove', (e) => {
    const opcao = e.target.closest('[data-opcao]');
    if (opcao && itens.indexOf(opcao) !== ativo) marcarAtivo(itens.indexOf(opcao));
  });

  limpar.addEventListener('click', () => {
    campo.value = '';
    atualizarLimpar();
    campo.focus();
    mostrarRecentes();
  });

  campo.addEventListener('blur', () => setTimeout(fecharPainel, 120));

  // Celular: a lupa abre a busca em tela cheia
  alvo.querySelector('.busca-abrir').addEventListener('click', () => {
    form.classList.add('aberta');
    document.body.classList.add('busca-aberta');
    campo.focus();
  });
  alvo.querySelector('.busca-voltar').addEventListener('click', () => {
    form.classList.remove('aberta');
    document.body.classList.remove('busca-aberta');
    fecharPainel();
  });

  // Atalho "/" foca a busca (fora de campos de texto)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
    e.preventDefault();
    if (matchMedia('(max-width: 640px)').matches) alvo.querySelector('.busca-abrir').click();
    else campo.focus();
  });
}
