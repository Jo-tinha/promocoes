// Página "Notificar" (usuário logado): escolher jogos para acompanhar e ver os avisos de promoção
import './style.css';
import { iniciarSessao, atualizarSino } from './sessao.js';
import { listarJogos } from './destaques.js';
import { buscarPromocoes } from './api.js';
import { imgJogo, varsDaLoja } from './lojas.js';
import {
  listarSeguindo,
  seguirJogo,
  deixarDeSeguir,
  definirPrecoAlvo,
  buscarAvisos,
  marcarAvisosComoLidos,
} from './usuarios.js';
import { contexto, carregarContexto, precoEmReal, dolarParaReal, nomeDaLoja } from './contexto.js';
import { esc, IMAGEM_PADRAO } from './util.js';

const elPrecisaLogin = document.querySelector('#precisa-login');
const elConteudo = document.querySelector('#conteudo');
const elListaAvisos = document.querySelector('#lista-avisos');
const elNotaAvisos = document.querySelector('#nota-avisos');
const botaoLidos = document.querySelector('#marcar-lidos');
const elListaJogos = document.querySelector('#lista-jogos');
const elNotaJogos = document.querySelector('#nota-jogos');
const elBusca = document.querySelector('#busca-jogos');

let uid = null;
let jogos = [];
let seguindo = new Map(); // gameID → documento seguido
let avisosAtuais = [];

// ---------- Avisos ----------
function linhaAviso(a) {
  return `
    <div class="promo-linha${a.novo ? ' nova' : ''}">
      <img class="miniatura" src="${esc(a.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
      <div class="promo-info">
        <a href="${esc(a.link)}" target="_blank" rel="noopener sponsored"><strong>${esc(a.titulo)}</strong></a>
        <span class="secao-nota">${esc(nomeDaLoja(a.lojaId))} · -${a.desconto}%${a.novo ? '<span class="selo-nova">Novo</span>' : ''}</span>
      </div>
      <div class="promo-preco">
        <span class="preco-antigo">${precoEmReal(a.precoNormal)}</span>
        <strong>${precoEmReal(a.precoPromocional)}</strong>
      </div>
      <a class="botao secundario pequeno" href="${esc(a.link)}" target="_blank" rel="noopener sponsored">Ver na loja</a>
    </div>`;
}

async function carregarAvisos() {
  try {
    const { avisos, novos } = await buscarAvisos(uid, dolarParaReal);
    avisosAtuais = avisos;
    botaoLidos.hidden = novos === 0;
    if (!seguindo.size) {
      elNotaAvisos.textContent = 'Você ainda não acompanha nenhum jogo. Escolha abaixo.';
      elListaAvisos.innerHTML = '';
      return;
    }
    elNotaAvisos.textContent = avisos.length
      ? `${novos ? `${novos} ${novos === 1 ? 'aviso novo' : 'avisos novos'} · ` : ''}promoções dos jogos que você acompanha`
      : 'Nenhum dos seus jogos está em promoção agora. Avisamos quando entrar.';
    elListaAvisos.innerHTML = avisos.map(linhaAviso).join('');
  } catch (erro) {
    console.error(erro);
    elNotaAvisos.textContent = 'Não foi possível carregar seus avisos.';
  }
}

botaoLidos.addEventListener('click', async () => {
  botaoLidos.disabled = true;
  try {
    await marcarAvisosComoLidos(uid, avisosAtuais.map((a) => a.dealID));
    await carregarAvisos();
    atualizarSino(uid);
  } finally {
    botaoLidos.disabled = false;
  }
});

// ---------- Escolher jogos (CRUD de usuarios/{uid}/seguindo) ----------
const elListaAcomp = document.querySelector('#lista-acompanhando');
const elQtdAcomp = document.querySelector('#qtd-acompanhando');
const botaoRemoverTodas = document.querySelector('#remover-todas');
const elFiltros = document.querySelector('#filtros-jogos');
const elResumo = document.querySelector('#resumo-jogos');
const elChips = document.querySelector('#chips-notificar');
const botaoMais = document.querySelector('#mais-jogos');
const elCarregando = document.querySelector('#carregando-jogos');
const POR_VEZ = 48;
let mostrar = 'todos';
let limite = POR_VEZ;

// busca sem acento, sem maiúsculas e sem pontuação ("pokemon" acha "Pokémon™")
const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Relevância: título igual > começa com > alguma palavra começa com > contém; todas as palavras precisam aparecer
function pontuar(j, termo) {
  if (!termo) return 1;
  const t = j.busca;
  const palavras = termo.split(' ');
  if (!palavras.every((p) => t.includes(p))) return 0;
  if (t === termo) return 100;
  if (t.startsWith(termo)) return 80;
  if (t.split(' ').some((w) => w.startsWith(palavras[0]))) return 60;
  return 40;
}

function destacarTrecho(titulo, termo) {
  if (!termo) return esc(titulo);
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const p = termo.split(' ')[0];
  const i = base.indexOf(p);
  if (i < 0) return esc(titulo);
  return `${esc(titulo.slice(0, i))}<mark>${esc(titulo.slice(i, i + p.length))}</mark>${esc(titulo.slice(i + p.length))}`;
}

const precoReal = (j) => (j.preco == null ? null : dolarParaReal(j.preco));

function cartaoNotificar(j, termo) {
  const seg = seguindo.get(j.gameID);
  const quando = j.data ? j.data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';
  return `
    <article class="cartao-notificar${seg ? ' seguindo' : ''}" style="${varsDaLoja(j.lojaId)}">
      <div class="cartao-notificar-capa jogo-capa">
        ${imgJogo(j)}
        ${j.emOfertaAgora && j.desconto ? `<span class="desconto">-${j.desconto}%</span>` : ''}
        ${seg ? '<span class="selo-seguindo">🔔 Acompanhando</span>' : ''}
      </div>
      <div class="cartao-notificar-corpo">
        <h3 title="${esc(j.titulo)}">${destacarTrecho(j.titulo, termo)}</h3>
        <p class="cartao-notificar-meta">
          ${j.lojaId ? `<span class="nome-loja">${esc(nomeDaLoja(j.lojaId))}</span>` : ''}
          ${j.emOfertaAgora ? '<span class="tag-oferta">em oferta</span>' : quando ? `<span>última oferta ${quando}</span>` : ''}
        </p>
        ${j.preco != null ? `<p class="cartao-notificar-preco">${j.emOfertaAgora ? '' : '<small>último preço</small>'}<strong>${precoEmReal(j.preco)}</strong></p>` : ''}
        <button class="botao ${seg ? 'remover-notificacao' : ''} pequeno" type="button" data-seguir="${esc(j.gameID)}">
          ${seg ? '🔕 Remover notificação' : '🔔 Notificar'}
        </button>
      </div>
    </article>`;
}

function renderizarAcompanhando() {
  const lista = [...seguindo.values()].map((s) => ({ ...s, ...(jogos.find((j) => j.gameID === s.gameID) || {}), precoAlvo: s.precoAlvo }));
  lista.sort((a, b) => Number(Boolean(b.emOfertaAgora)) - Number(Boolean(a.emOfertaAgora)) || a.titulo.localeCompare(b.titulo));
  elQtdAcomp.textContent = lista.length;
  botaoRemoverTodas.hidden = lista.length < 2;
  elListaAcomp.innerHTML = lista.length
    ? lista
        .map(
          (j) => `
      <div class="acompanhando-item${j.emOfertaAgora ? ' em-oferta' : ''}">
        ${imgJogo(j)}
        <div class="acompanhando-info">
          <strong title="${esc(j.titulo)}">${esc(j.titulo)}</strong>
          <small>${j.emOfertaAgora ? `🔥 em oferta agora${j.desconto ? ` · -${j.desconto}%` : ''}${j.preco != null ? ` · ${precoEmReal(j.preco)}` : ''}` : 'aguardando promoção'}</small>
        </div>
        <label class="preco-alvo">Avisar até R$
          <input type="number" min="1" step="1" placeholder="qualquer" value="${j.precoAlvo ?? ''}" data-alvo="${esc(j.gameID)}" />
        </label>
        <button class="botao remover-notificacao pequeno" type="button" data-seguir="${esc(j.gameID)}" aria-label="Remover notificação de ${esc(j.titulo)}">🔕 Remover</button>
      </div>`,
        )
        .join('')
    : '<div class="aviso">Você ainda não acompanha nenhum jogo. Use a busca abaixo e toque em “🔔 Notificar”.</div>';
}

function lerFiltros() {
  const f = elFiltros.elements;
  return {
    termo: normalizar(elBusca.value),
    loja: f.loja.value,
    desc: Number(f.desc.value) || 0,
    max: Number(f.max.value) || 0,
    ordem: f.ordem.value,
  };
}

const ORDENAR = {
  relevancia: (a, b) => b.pontos - a.pontos || Number(Boolean(b.emOfertaAgora)) - Number(Boolean(a.emOfertaAgora)) || a.titulo.localeCompare(b.titulo),
  az: (a, b) => a.titulo.localeCompare(b.titulo),
  za: (a, b) => b.titulo.localeCompare(a.titulo),
  desconto: (a, b) => (b.desconto || 0) - (a.desconto || 0),
  preco: (a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity),
  recente: (a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0),
};

function renderizarJogos() {
  const f = lerFiltros();
  const filtrados = jogos
    .map((j) => ({ ...j, pontos: pontuar(j, f.termo) }))
    .filter((j) => j.pontos > 0)
    .filter((j) => mostrar !== 'oferta' || j.emOfertaAgora)
    .filter((j) => mostrar !== 'seguindo' || seguindo.has(j.gameID))
    .filter((j) => mostrar !== 'nao' || !seguindo.has(j.gameID))
    .filter((j) => !f.loja || String(j.lojaId) === f.loja)
    .filter((j) => !f.desc || (j.desconto || 0) >= f.desc)
    .filter((j) => !f.max || (precoReal(j) != null && precoReal(j) <= f.max))
    .sort(ORDENAR[f.ordem] || ORDENAR.relevancia);

  const temFiltro = f.loja || f.desc || f.max || f.ordem !== 'relevancia' || mostrar !== 'todos';
  document.querySelector('#limpar-filtros-jogos').hidden = !temFiltro;
  elNotaJogos.textContent = `Jogos em oferta agora e que já passaram pelo Buba Promo · você acompanha ${seguindo.size} de ${jogos.length}.`;
  elResumo.textContent = f.termo || temFiltro ? `${filtrados.length} ${filtrados.length === 1 ? 'jogo encontrado' : 'jogos encontrados'}` : '';
  const visiveis = filtrados.slice(0, limite);
  elListaJogos.innerHTML = visiveis.length
    ? visiveis.map((j) => cartaoNotificar(j, f.termo)).join('')
    : `<div class="aviso">${
        jogos.length
          ? `Nenhum jogo com esses filtros.${elBusca.value.trim() ? ' Pressione <strong>Enter</strong> para procurar em todas as lojas.' : ''}`
          : 'Ainda não há jogos na lista. Eles aparecem quando entram em oferta no Buba Promo.'
      }</div>`;
  botaoMais.hidden = filtrados.length <= limite;
  botaoMais.textContent = `Mostrar mais (${filtrados.length - limite})`;
  renderizarAcompanhando();
  guardarNoEndereco(f);
}

// filtros no endereço da página (dá para voltar ou compartilhar a mesma busca)
function guardarNoEndereco(f) {
  const p = new URLSearchParams();
  if (elBusca.value.trim()) p.set('q', elBusca.value.trim());
  if (mostrar !== 'todos') p.set('mostrar', mostrar);
  if (f.loja) p.set('loja', f.loja);
  if (f.desc) p.set('desc', f.desc);
  if (f.max) p.set('max', f.max);
  if (f.ordem !== 'relevancia') p.set('ordem', f.ordem);
  history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
}
function lerDoEndereco() {
  const p = new URLSearchParams(location.search);
  elBusca.value = p.get('q') || '';
  mostrar = ['todos', 'oferta', 'seguindo', 'nao'].includes(p.get('mostrar')) ? p.get('mostrar') : 'todos';
  const f = elFiltros.elements;
  f.loja.value = p.get('loja') || '';
  f.desc.value = p.get('desc') || '';
  f.max.value = p.get('max') || '';
  f.ordem.value = ORDENAR[p.get('ordem')] ? p.get('ordem') : 'relevancia';
  marcarChips();
}
function marcarChips() {
  elChips.querySelectorAll('[data-mostrar]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.mostrar === mostrar)));
}

const reiniciarLista = () => {
  limite = POR_VEZ;
  renderizarJogos();
};
let esperaDigitar;
elBusca.addEventListener('input', () => {
  clearTimeout(esperaDigitar);
  esperaDigitar = setTimeout(reiniciarLista, 120);
  agendarBuscaAoVivo();
});
elFiltros.addEventListener('change', reiniciarLista);
elFiltros.addEventListener('submit', (e) => e.preventDefault());
elChips.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-mostrar]');
  if (!chip) return;
  mostrar = chip.dataset.mostrar;
  marcarChips();
  reiniciarLista();
});
document.querySelector('#limpar-filtros-jogos').addEventListener('click', () => {
  elFiltros.reset();
  mostrar = 'todos';
  marcarChips();
  reiniciarLista();
});
botaoMais.addEventListener('click', () => {
  limite += POR_VEZ;
  renderizarJogos();
});

async function alternarSeguir(gameID, botao) {
  botao.disabled = true;
  try {
    if (seguindo.has(gameID)) {
      await deixarDeSeguir(uid, gameID);
      seguindo.delete(gameID);
    } else {
      const jogo = jogos.find((j) => j.gameID === gameID);
      await seguirJogo(uid, jogo);
      seguindo.set(gameID, { gameID, titulo: jogo.titulo, imagem: jogo.imagem, precoAlvo: null });
    }
    renderizarJogos();
    carregarAvisos();
    atualizarSino(uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível atualizar. Tente novamente.');
    botao.disabled = false;
  }
}

for (const lista of [elListaJogos, elListaAcomp]) {
  lista.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-seguir]');
    if (botao) alternarSeguir(botao.dataset.seguir, botao);
  });
}

botaoRemoverTodas.addEventListener('click', async () => {
  if (!confirm(`Remover a notificação dos ${seguindo.size} jogos que você acompanha?`)) return;
  botaoRemoverTodas.disabled = true;
  try {
    await Promise.all([...seguindo.keys()].map((id) => deixarDeSeguir(uid, id)));
    seguindo.clear();
    renderizarJogos();
    carregarAvisos();
    atualizarSino(uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível remover todas. Tente de novo.');
  } finally {
    botaoRemoverTodas.disabled = false;
  }
});

// Preço-alvo: salva ao sair do campo
elListaAcomp.addEventListener('change', async (e) => {
  const campo = e.target.closest('[data-alvo]');
  if (!campo) return;
  const gameID = campo.dataset.alvo;
  const valor = campo.value ? Number(campo.value) : null;
  if (valor !== null && !(valor > 0)) return;
  try {
    await definirPrecoAlvo(uid, gameID, valor);
    seguindo.get(gameID).precoAlvo = valor;
    carregarAvisos();
    atualizarSino(uid);
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível salvar o preço.');
  }
});

// Junta: jogos já destacados + jogos em oferta agora + jogos que o usuário já acompanha (sem repetir)
function juntarJogos(...fontes) {
  const mapa = new Map();
  for (const lista of fontes) {
    for (const j of lista) {
      if (!j.gameID) continue;
      const atual = mapa.get(j.gameID) || {};
      const emOferta = j.precoPromocional !== undefined;
      const data = j.ultimaPromocaoEm?.toDate?.() || (emOferta ? new Date() : null);
      mapa.set(j.gameID, {
        ...j,
        ...atual,
        titulo: atual.titulo || j.titulo,
        imagem: atual.imagem || j.imagem,
        steamAppID: atual.steamAppID || j.steamAppID,
        lojaId: emOferta ? j.lojaId : atual.lojaId || j.lojaId,
        emOfertaAgora: atual.emOfertaAgora || emOferta,
        // preço em dólar: o de agora (se em oferta) ou o último registrado no catálogo
        preco: emOferta ? j.precoPromocional : atual.preco ?? j.ultimoPreco ?? null,
        desconto: emOferta ? j.desconto : atual.desconto ?? j.ultimoDesconto ?? null,
        data: atual.data && data ? new Date(Math.max(atual.data, data)) : atual.data || data,
      });
    }
  }
  return [...mapa.values()].map((j) => ({ ...j, busca: normalizar(j.titulo) }));
}

// Busca ao vivo na CheapShark (jogos em oferta com esse nome): ao parar de digitar ou com Enter
let esperaAoVivo;
function agendarBuscaAoVivo(imediato = false) {
  clearTimeout(esperaAoVivo);
  const termo = elBusca.value.trim();
  if (termo.length < 3) return;
  esperaAoVivo = setTimeout(async () => {
    elCarregando.hidden = false;
    try {
      const achados = await buscarPromocoes({ termo, limite: 60 });
      const antes = jogos.length;
      jogos = juntarJogos(jogos, achados);
      if (jogos.length !== antes || imediato) renderizarJogos();
    } catch (erro) {
      console.error(erro);
    } finally {
      elCarregando.hidden = true;
    }
  }, imediato ? 0 : 600);
}
elBusca.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    agendarBuscaAoVivo(true);
  }
});

// ---------- Início ----------
iniciarSessao('notificar', async ({ usuario }) => {
  elPrecisaLogin.hidden = Boolean(usuario);
  elConteudo.hidden = !usuario;
  if (!usuario) return;
  uid = usuario.uid;
  elListaJogos.innerHTML = '<div class="aviso">Carregando jogos…</div>';
  try {
    await carregarContexto();
    const [listaJogos, listaSeguindo, emOferta] = await Promise.all([
      listarJogos().catch(() => []),
      listarSeguindo(uid),
      buscarPromocoes({ ordem: 'Deal Rating', limite: 60 }).catch(() => []),
    ]);
    jogos = juntarJogos(emOferta, listaJogos, listaSeguindo);
    seguindo = new Map(listaSeguindo.map((s) => [s.gameID, s]));
    const elLoja = elFiltros.elements.loja;
    const lojasNaLista = new Set(jogos.map((j) => String(j.lojaId)).filter(Boolean));
    elLoja.innerHTML =
      '<option value="">Todas</option>' +
      [...contexto.lojas.values()].filter((l) => lojasNaLista.has(String(l.id))).map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('');
    lerDoEndereco();
    renderizarJogos();
    if (elBusca.value.trim()) agendarBuscaAoVivo(true);
    carregarAvisos();
  } catch (erro) {
    console.error(erro);
    elListaJogos.innerHTML = '<div class="aviso erro">Não foi possível carregar os jogos.</div>';
  }
});
