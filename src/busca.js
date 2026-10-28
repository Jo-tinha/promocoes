// Página de resultados da busca: promoções com filtros (loja, preço, desconto, grátis, ordem)
// e, abaixo, os jogos com o mesmo nome que não estão em promoção agora
import './style.css';
import { iniciarSessao } from './sessao.js';
import { buscarPromocoes, buscarJogosPorNome } from './api.js';
import { contexto, carregarContexto, precoEmReal } from './contexto.js';
import { imgJogo } from './lojas.js';
import { ATALHOS } from './atalhos-busca.js';
import { cartaoItem, agruparPorJogo, esqueletos, redesenharEstrelas } from './cartoes.js';
import { abrirEscolha } from './escolher-loja.js';
import { definirUsuario, carregarEstrelas, ativarEstrelas, botaoEstrela } from './estrela.js';
import { salvarNoCatalogo } from './catalogo.js';
import { esc } from './util.js';

const $ = (s) => document.querySelector(s);
const form = $('#filtros-busca');
const grade = $('#resultados');
const botaoMais = $('#carregar-mais');
const POR_PAGINA = 60;

const params = new URLSearchParams(location.search);
const termo = (params.get('q') || '').trim();
const estado = { pagina: 0, total: 0, promos: new Map(), gameIDs: new Set(), carregando: false };

// ---------- Atalhos ("tipos de busca" prontos) ----------
// Funcionam com ou sem nome digitado: sem nome, exploram todas as promoções.
// atalhos compartilhados com a busca do painel do admin

const PADRAO = { loja: '', max: '', desc: '', ordem: 'Deal Rating', steam: '', mc: '', aaa: false, gratis: false };

function aplicarValores(valores) {
  const f = form.elements;
  const v = { ...PADRAO, ...valores };
  f.loja.value = v.loja;
  f.max.value = v.max;
  f.desc.value = v.desc;
  f.ordem.value = v.ordem;
  f.steam.value = v.steam;
  f.mc.value = v.mc;
  f.aaa.checked = Boolean(v.aaa);
  f.gratis.checked = Boolean(v.gratis);
}

// qual atalho corresponde aos filtros de agora (para marcá-lo e dar o título da página)
function atalhoAtivo(filtros) {
  return ATALHOS.find((a) => {
    const v = { ...PADRAO, ...a.filtros };
    return (
      String(v.ordem) === filtros.ordem &&
      String(v.max) === String(filtros.max ?? '') &&
      String(v.desc) === String(filtros.desc || '') &&
      String(v.steam) === String(filtros.steam || '') &&
      String(v.mc) === String(filtros.mc || '') &&
      Boolean(v.aaa) === filtros.aaa &&
      Boolean(v.gratis) === filtros.gratis &&
      !filtros.loja
    );
  });
}

function renderizarAtalhos(filtros) {
  const ativo = atalhoAtivo(filtros);
  $('#atalhos-busca').innerHTML = ATALHOS.map(
    (a) => `<button type="button" class="chip" data-atalho="${a.id}" aria-pressed="${ativo?.id === a.id}">${a.rotulo}</button>`,
  ).join('');
  return ativo;
}

// ---------- Filtros <-> endereço (para o link poder ser compartilhado) ----------
function lerFiltros() {
  const f = form.elements;
  return {
    loja: f.loja.value,
    max: f.max.value ? Number(f.max.value) : null,
    desc: f.desc.value ? Number(f.desc.value) : 0,
    ordem: f.ordem.value,
    steam: f.steam.value ? Number(f.steam.value) : 0,
    mc: f.mc.value ? Number(f.mc.value) : 0,
    aaa: f.aaa.checked,
    gratis: f.gratis.checked,
  };
}

function aplicarFiltrosDaUrl() {
  aplicarValores({
    loja: params.get('loja') || '',
    max: params.get('max') || '',
    desc: params.get('desc') || '',
    ordem: params.get('ordem') || 'Deal Rating',
    steam: params.get('steam') || '',
    mc: params.get('mc') || '',
    aaa: params.get('aaa') === '1',
    gratis: params.get('gratis') === '1',
  });
}

const temFiltro = (f) => f.loja || f.max || f.desc || f.gratis || f.steam || f.mc || f.aaa;

function gravarFiltrosNaUrl(filtros) {
  const p = new URLSearchParams();
  if (termo) p.set('q', termo);
  if (filtros.loja) p.set('loja', filtros.loja);
  if (filtros.max) p.set('max', filtros.max);
  if (filtros.desc) p.set('desc', filtros.desc);
  if (filtros.ordem !== 'Deal Rating') p.set('ordem', filtros.ordem);
  if (filtros.steam) p.set('steam', filtros.steam);
  if (filtros.mc) p.set('mc', filtros.mc);
  if (filtros.aaa) p.set('aaa', '1');
  if (filtros.gratis) p.set('gratis', '1');
  history.replaceState(null, '', `/busca.html${p.toString() ? `?${p}` : ''}`);
  $('#limpar-filtros').hidden = !temFiltro(filtros) && filtros.ordem === 'Deal Rating';
  // título: nome buscado, ou o atalho escolhido, ou "Explorar promoções"
  const ativo = renderizarAtalhos(filtros);
  if (termo) $('#titulo-busca').innerHTML = `Resultados para “<span>${esc(termo)}</span>”`;
  else $('#titulo-busca').textContent = ativo ? ativo.titulo : 'Explorar promoções';
  document.title = `${termo || ativo?.titulo || 'Explorar promoções'} · Buba Promo`;
}

// ---------- Resultados ----------
function resumo(filtros, fim) {
  const partes = [];
  if (filtros.loja) partes.push(contexto.lojas.get(filtros.loja)?.nome || 'loja escolhida');
  if (filtros.gratis) partes.push('só grátis');
  else if (filtros.max) partes.push(`até R$ ${filtros.max}`);
  if (filtros.desc) partes.push(`${filtros.desc}%+ de desconto`);
  if (filtros.steam) partes.push(`Steam ${filtros.steam}%+`);
  if (filtros.mc) partes.push(`Metacritic ${filtros.mc}+`);
  if (filtros.aaa) partes.push('só AAA');
  const n = estado.total;
  $('#resumo-busca').textContent =
    `${n}${fim ? '' : '+'} ${n === 1 ? 'promoção encontrada' : 'promoções encontradas'}` + (partes.length ? ` · ${partes.join(' · ')}` : '');
}

async function carregar({ reiniciar = false } = {}) {
  if (estado.carregando) return;
  estado.carregando = true;
  const filtros = lerFiltros();
  if (reiniciar) {
    estado.pagina = 0;
    estado.total = 0;
    estado.gameIDs.clear();
    grade.innerHTML = esqueletos(8);
    gravarFiltrosNaUrl(filtros);
  }
  botaoMais.hidden = true;
  try {
    await carregarContexto();
    // preço máximo em R$ vira dólar para a API (a CheapShark trabalha em dólar)
    const precoMaximo = filtros.gratis ? 0 : filtros.max && contexto.cotacao ? Math.max(1, Math.ceil(filtros.max / contexto.cotacao)) : null;
    const lista = await buscarPromocoes({
      termo,
      lojaId: filtros.loja,
      ordem: filtros.ordem,
      limite: POR_PAGINA,
      pagina: estado.pagina,
      precoMaximo,
      steamMin: filtros.steam,
      metacriticMin: filtros.mc,
      aaa: filtros.aaa,
    });
    const filtrada = lista
      .filter((p) => p.desconto >= filtros.desc)
      .filter((p) => !filtros.gratis || p.precoPromocional === 0)
      .filter((p) => !filtros.max || !contexto.cotacao || p.precoPromocional * contexto.cotacao <= filtros.max);
    filtrada.forEach((p) => {
      estado.promos.set(p.dealID, p);
      if (p.gameID) estado.gameIDs.add(p.gameID);
    });
    salvarNoCatalogo(filtrada);
    // o mesmo jogo em várias lojas vira um cartão só (o grupo inclui páginas anteriores)
    const itens = agruparPorJogo(filtrada);
    itens.forEach((it) => estado.promos.set(it.dealID, it));
    const html = itens.map((p, i) => cartaoItem(p, { especial: true, i })).join('');
    if (reiniciar) grade.innerHTML = html;
    else grade.insertAdjacentHTML('beforeend', html);
    estado.total += filtrada.length;
    estado.pagina += 1;
    const fim = lista.length < POR_PAGINA;
    botaoMais.hidden = fim;
    resumo(filtros, fim);
    if (!estado.total && fim) {
      grade.innerHTML = `<div class="aviso">
        Nenhuma promoção${termo ? ` para “${esc(termo)}”` : ''}${temFiltro(filtros) ? ' com esses filtros' : ''}.
        ${temFiltro(filtros) ? '<br /><button class="botao secundario pequeno" type="button" data-limpar>Limpar filtros</button>' : termo ? '<br />Confira a grafia, tente o nome em inglês ou veja abaixo os jogos que não estão em promoção.' : ''}
      </div>`;
    }
    if (reiniciar && termo) carregarOutros();
    else if (reiniciar) $('#sec-outros').hidden = true;
  } catch (erro) {
    console.error(erro);
    if (reiniciar) grade.innerHTML = '<div class="aviso erro">Não foi possível buscar agora. Tente de novo em instantes.</div>';
    botaoMais.hidden = false;
  } finally {
    estado.carregando = false;
  }
}

// Jogos com esse nome que não aparecem nas promoções (para estrelar e ser avisado)
async function carregarOutros() {
  const secao = $('#sec-outros');
  try {
    const jogos = (await buscarJogosPorNome(termo, { limite: 30 })).filter((j) => !estado.gameIDs.has(j.gameID));
    secao.hidden = !jogos.length;
    $('#lista-outros').innerHTML = jogos
      .map(
        (j) => `
        <div class="outro-jogo">
          ${imgJogo(j)}
          <div class="outro-info">
            <strong title="${esc(j.titulo)}">${esc(j.titulo)}</strong>
            <small>menor preço atual: ${j.menorPreco === 0 ? 'grátis' : precoEmReal(j.menorPreco)}</small>
          </div>
          ${botaoEstrela(j)}
        </div>`,
      )
      .join('');
  } catch (erro) {
    console.error(erro);
    secao.hidden = true;
  }
}

// ---------- Eventos ----------
let espera;
form.addEventListener('input', (e) => {
  clearTimeout(espera);
  // número digitado espera um pouco; selects e checkbox aplicam na hora
  espera = setTimeout(() => carregar({ reiniciar: true }), e.target.name === 'max' ? 600 : 0);
});
form.addEventListener('submit', (e) => e.preventDefault());
document.addEventListener('click', (e) => {
  if (!e.target.closest('#limpar-filtros, [data-limpar]')) return;
  aplicarValores(PADRAO);
  carregar({ reiniciar: true });
});
botaoMais.addEventListener('click', () => carregar());
$('#atalhos-busca').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-atalho]');
  if (!chip) return;
  const atalho = ATALHOS.find((a) => a.id === chip.dataset.atalho);
  // clicar de novo no atalho ativo desliga ele
  aplicarValores(chip.getAttribute('aria-pressed') === 'true' ? PADRAO : atalho.filtros);
  carregar({ reiniciar: true });
});
new IntersectionObserver((entradas) => {
  if (entradas[0].isIntersecting && !botaoMais.hidden) carregar();
}, { rootMargin: '600px' }).observe(botaoMais);

ativarEstrelas();
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-escolher]');
  if (!alvo || e.target.closest('[data-estrela]')) return;
  const grupo = estado.promos.get(alvo.dataset.escolher);
  if (grupo?.agrupado) abrirEscolha(grupo);
});

// ---------- Início ----------
async function iniciar() {
  await carregarContexto();
  form.elements.loja.insertAdjacentHTML(
    'beforeend',
    [...contexto.lojas.values()].map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
  );
  aplicarFiltrosDaUrl();
  carregar({ reiniciar: true });
}
iniciar();

iniciarSessao('busca', async ({ usuario }) => {
  definirUsuario(usuario);
  await carregarEstrelas();
  redesenharEstrelas((dealID) => estado.promos.get(dealID));
  if (termo && !$('#sec-outros').hidden) carregarOutros(); // redesenha as estrelas dessa lista também
  if (usuario) salvarNoCatalogo([...estado.promos.values()]);
});
