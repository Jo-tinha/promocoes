// Abas "Averiguar promoções" e "Destaques": todas as promoções entram na vitrine automaticamente;
// o admin averigua o que está chegando e escolhe a dedo as que viram destaque.
import { buscarPromocoes, buscarPromocaoPorId } from './api.js';
import {
  destacar,
  listarDestaques,
  atualizarDestaque,
  removerDestaque,
  conferirDestaquesAoVivo,
  editarComentarioDestaque,
  alternarAtivoDestaque,
  definirExibicaoDestaque,
  salvarOrdemDestaques,
  definirVideoDestaque,
  definirFixoDestaque,
} from './destaques.js';
import { abrirDestacar, abrirTrocarImagens } from './admin-destacar.js';
import { executarRodizio, aplicarRodizio, destaquesAutomaticos, tempoRestante, adicionarAutomaticamente, METRICAS, METRICA_PADRAO } from './rodizio.js';
import { lerConfigRodizio } from './destaques.js';
import { ATALHOS } from './atalhos-busca.js';
import { videoValido } from './trailer.js';
import { editarManual } from './admin-adicionar.js';
import { contexto, carregarContexto, precoEmReal, nomeDaLoja } from './contexto.js';
import { esc, IMAGEM_PADRAO, formatarReal } from './util.js';
import { sincronizarCatalogo } from './catalogo.js';
import { textoSimples, abrirEditorComentario } from './texto-rico.js';

const formFiltros = document.querySelector('#filtros-averiguar');
const selectLoja = document.querySelector('#averiguar-loja');
const listaAveriguar = document.querySelector('#lista-averiguar');
const notaAveriguar = document.querySelector('#nota-averiguar');
const listaVitrine = document.querySelector('#lista-vitrine');
const notaVitrine = document.querySelector('#nota-vitrine');
const qtdVitrine = document.querySelector('#qtd-vitrine');
const botaoAtualizarTodas = document.querySelector('#atualizar-todas');

let chegando = []; // resultado atual da CheapShark
let naVitrine = []; // destaques (Firestore)
const aprovadas = () => new Set(naVitrine.map((p) => p.dealID));

// ---------- Averiguar ----------
function linhaChegando(p, jaAprovada) {
  return `
    <div class="promo-linha${jaAprovada ? '' : ' nova'}">
      <img class="miniatura" src="${esc(p.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
      <div class="promo-info">
        <a href="${esc(p.link)}" target="_blank" rel="noopener"><strong>${esc(p.titulo)}</strong></a>
        <span class="secao-nota">${esc(nomeDaLoja(p.lojaId))} · -${p.desconto}%${p.avaliacao ? ` · Steam: ${esc(p.avaliacao)}` : ''}</span>
      </div>
      <div class="promo-preco">
        <span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>
        <strong>${precoEmReal(p.precoPromocional)}</strong>
      </div>
      <div class="acoes-linha">
        ${
          jaAprovada
            ? '<span class="status ok">★ Destaque</span>'
            : `<button class="botao pequeno" type="button" data-aprovar="${esc(p.dealID)}">★ Destacar</button>`
        }
      </div>
    </div>`;
}

function renderizarChegando() {
  const ja = aprovadas();
  const soNovas = formFiltros.elements.soNovas.checked;
  const lista = chegando.filter((p) => !soNovas || !ja.has(p.dealID));
  const pendentes = chegando.filter((p) => !ja.has(p.dealID)).length;
  notaAveriguar.textContent = `${chegando.length} promoções chegando (todas já aparecem na vitrine) · ${chegando.length - pendentes} em destaque.`;
  listaAveriguar.innerHTML = lista.length
    ? lista.map((p) => linhaChegando(p, ja.has(p.dealID))).join('')
    : '<div class="aviso">Nada novo por aqui com esses filtros.</div>';
}

// Filtros da busca (os mesmos do Explorar)
const PADRAO = { termo: '', loja: '', ordem: 'Recent', max: '', desc: '', steam: '', mc: '', aaa: false, gratis: false };
let pagina = 0;

function lerFiltros() {
  const f = formFiltros.elements;
  return {
    termo: f.termo.value.trim(),
    loja: f.loja.value,
    ordem: f.ordem.value,
    max: f.max.value ? Number(f.max.value) : '',
    desc: f.desc.value ? Number(f.desc.value) : 0,
    steam: f.steam.value,
    mc: f.mc.value,
    aaa: f.aaa.checked,
    gratis: f.gratis.checked,
  };
}

function aplicarFiltros(valores) {
  const f = formFiltros.elements;
  const v = { ...PADRAO, termo: f.termo.value, ...valores };
  f.termo.value = v.termo;
  f.loja.value = v.loja;
  f.ordem.value = v.ordem;
  f.max.value = v.max;
  f.desc.value = v.desc;
  f.steam.value = v.steam;
  f.mc.value = v.mc;
  f.aaa.checked = Boolean(v.aaa);
  f.gratis.checked = Boolean(v.gratis);
}

const temFiltro = (f) => f.loja || f.max || f.desc || f.steam || f.mc || f.aaa || f.gratis || f.ordem !== PADRAO.ordem;

function atalhoAtivo(f) {
  return ATALHOS.find((a) => {
    const v = { ...PADRAO, ...a.filtros };
    return (
      v.ordem === f.ordem && String(v.max) === String(f.max) && String(v.desc || '') === String(f.desc || '') &&
      String(v.steam) === String(f.steam) && String(v.mc) === String(f.mc) && Boolean(v.aaa) === f.aaa &&
      Boolean(v.gratis) === f.gratis && !f.loja
    );
  });
}

function desenharAtalhos() {
  const ativo = atalhoAtivo(lerFiltros());
  document.querySelector('#atalhos-averiguar').innerHTML = ATALHOS.map(
    (a) => `<button type="button" class="chip" data-atalho="${a.id}" aria-pressed="${ativo?.id === a.id}">${a.rotulo}</button>`,
  ).join('');
  document.querySelector('#limpar-averiguar').hidden = !temFiltro(lerFiltros());
}

async function buscarChegando({ mais = false } = {}) {
  const f = lerFiltros();
  const botaoMais = document.querySelector('#mais-averiguar');
  desenharAtalhos();
  if (!mais) {
    pagina = 0;
    listaAveriguar.innerHTML = '<div class="aviso">Consultando a CheapShark…</div>';
  }
  botaoMais.disabled = true;
  try {
    const precoMaximo = f.gratis ? 0 : f.max && contexto.cotacao ? Math.max(1, Math.ceil(f.max / contexto.cotacao)) : null;
    const novos = await buscarPromocoes({
      termo: f.termo,
      lojaId: f.loja,
      ordem: f.ordem,
      limite: 60,
      pagina,
      precoMaximo,
      steamMin: Number(f.steam) || 0,
      metacriticMin: Number(f.mc) || 0,
      aaa: f.aaa,
    });
    const filtrados = novos.filter((p) => p.desconto >= (f.desc || 0)).filter((p) => !f.gratis || p.precoPromocional === 0);
    const vistos = new Set(chegando.map((p) => p.dealID));
    chegando = mais ? [...chegando, ...filtrados.filter((p) => !vistos.has(p.dealID))] : filtrados;
    botaoMais.hidden = novos.length < 60;
    renderizarChegando();
  } catch (erro) {
    console.error(erro);
    if (!mais) listaAveriguar.innerHTML = '<div class="aviso erro">Não foi possível consultar a CheapShark agora.</div>';
  } finally {
    botaoMais.disabled = false;
  }
}

// O que a vitrine está mostrando agora, incluindo os destaques automáticos (iguais aos outros):
// - os que o rodízio de 24 h já colocou no lugar dos vencidos (mesmo antes de gravar);
// - os que completam a vitrine sozinhos quando faltam destaques (mesma regra de src/rodizio.js).
async function destaquesComoNaVitrine() {
  const ativos = naVitrine.filter((d) => d.ativo && d.emPromocao !== false);
  const pausados = naVitrine.filter((d) => !d.ativo);
  let lista = ativos;
  try {
    const { lista: girada, trocas } = await aplicarRodizio(ativos);
    lista = girada.map((d) => {
      const troca = trocas.find((t) => t.entrou === d);
      return troca ? { ...d, substitui: troca.saiu } : d;
    });
    if (!lista.length) lista = await destaquesAutomaticos(5);
    else if (!lista.some((d) => d.exibir !== 'faixa')) {
      lista = [...lista, ...(await destaquesAutomaticos(5, { excluir: lista, exibir: 'banner' }))];
    }
  } catch (erro) {
    console.warn(erro);
  }
  return [...lista, ...pausados];
}

// ---------- Na vitrine ----------
// situação de agora (vinda da conferência ao vivo); undefined = ainda conferindo
function situacao(p) {
  if (!p.ativo) return '<span class="status off">Pausado</span>';
  if (p.emPromocao === undefined) return '<span class="status off">conferindo…</span>';
  if (!p.emPromocao) return `<span class="status encerrada">${p.manual ? 'Data passou' : 'Encerrada'}</span>`;
  if (p.precoMudou) return '<span class="status mudou">Preço mudou</span>';
  const rodizio = p.fixo ? '📌 Fixo' : `sai em ${horasEMin(tempoRestante(p))}`;
  if (p.manual && p.termina) return `<span class="status ok">Até ${p.termina.split('-').reverse().join('/')}</span><br /><span class="secao-nota">${rodizio}</span>`;
  return `<span class="status ok">No ar</span><br /><span class="secao-nota">${rodizio}</span>`;
}

function horasEMin(ms) {
  if (ms <= 0) return 'instantes (rodízio)';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const valor = (p, v) => (p.moeda === 'BRL' ? formatarReal(v) : precoEmReal(v));

function precoCelula(p) {
  if (p.precoPromocional === null || p.precoPromocional === undefined) return '<span class="secao-nota">sem preço</span>';
  const salvo = p.salvo || p;
  const mudou = p.emPromocao && p.precoMudou;
  return `
    ${mudou ? `<span class="preco-antigo">${valor(p, salvo.precoPromocional)}</span> → ` : p.precoNormal > p.precoPromocional ? `<span class="preco-antigo">${valor(p, p.precoNormal)}</span><br />` : ''}
    <strong>${p.precoPromocional === 0 ? 'Grátis' : valor(p, p.precoPromocional)}</strong>
    ${p.desconto ? `<span class="secao-nota">(-${p.desconto}%)</span>` : ''}`;
}

function linhaVitrine(p, posicao, total) {
  const mudou = p.emPromocao && p.precoMudou;
  const origem = p.manual ? `<span class="etiqueta manual">Manual</span> ${esc(p.lojaNome || nomeDaLoja(p.lojaId))}` : `<span class="etiqueta api">API</span> ${esc(nomeDaLoja(p.lojaId))}`;
  return `
    <tr class="${p.emPromocao === false || !p.ativo ? 'linha-encerrada' : ''}">
      <td class="ordem">
        <button class="botao secundario pequeno" type="button" data-mover="-1" data-id="${esc(p.id)}" ${posicao === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
        <button class="botao secundario pequeno" type="button" data-mover="1" data-id="${esc(p.id)}" ${posicao === total - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
      </td>
      <td><img class="miniatura" src="${esc(p.imagemCartao || p.imagem)}" alt="" onerror="this.src='${IMAGEM_PADRAO}'" /></td>
      <td><a href="${esc(p.link)}" target="_blank" rel="noopener"><strong>${esc(p.titulo)}</strong></a><br /><span class="secao-nota">${origem}${p.comentario ? ` · “${esc(textoSimples(p.comentario))}”` : ''}</span></td>
      <td>${precoCelula(p)}</td>
      <td>
        <select class="select-exibir" data-exibir="${esc(p.id)}" aria-label="Onde aparece">
          <option value="ambos" ${p.exibir === 'ambos' ? 'selected' : ''}>Banner e faixa</option>
          <option value="banner" ${p.exibir === 'banner' ? 'selected' : ''}>Só banner</option>
          <option value="faixa" ${p.exibir === 'faixa' ? 'selected' : ''}>Só faixa</option>
        </select>
      </td>
      <td>${situacao(p)}</td>
      <td>
        <div class="acoes-linha">
          ${
            p.manual
              ? `<button class="botao secundario pequeno" type="button" data-editar="${esc(p.id)}">Editar</button>`
              : `<button class="botao secundario pequeno" type="button" data-imagens="${esc(p.id)}">${p.imagemCartao || p.imagemBanner ? '🖼 Imagens ✓' : '🖼 Imagens'}</button>
                 <button class="botao secundario pequeno" type="button" data-comentar="${esc(p.id)}">Comentário</button>
                 <button class="botao secundario pequeno" type="button" data-atualizar="${esc(p.id)}">${mudou ? 'Salvar preço novo' : 'Atualizar preço'}</button>`
          }
          <button class="botao secundario pequeno" type="button" data-video="${esc(p.id)}" title="${p.video ? esc(p.video) : 'Sem link: usa o trailer da Steam'}">${p.video ? '🎬 Vídeo ✓' : '🎬 Vídeo'}</button>
          <button class="botao secundario pequeno" type="button" data-fixar="${esc(p.id)}" aria-pressed="${Boolean(p.fixo)}">${p.fixo ? '📌 Fixo' : 'Fixar'}</button>
          <button class="botao secundario pequeno" type="button" data-pausar="${esc(p.id)}">${p.ativo ? 'Pausar' : 'Ativar'}</button>
          <button class="botao perigo pequeno" type="button" data-remover="${esc(p.id)}">Remover</button>
        </div>
      </td>
    </tr>`;
}

const FILTROS = {
  '': () => true,
  ativos: (p) => p.ativo && p.emPromocao !== false,
  pausados: (p) => !p.ativo,
  manuais: (p) => p.manual,
  api: (p) => !p.manual,
  encerrados: (p) => p.emPromocao === false,
};

function desenharTabela() {
  const encerrados = naVitrine.filter((p) => p.emPromocao === false).length;
  const mudaram = naVitrine.filter((p) => p.emPromocao && p.precoMudou).length;
  const pausados = naVitrine.filter((p) => !p.ativo).length;
  qtdVitrine.hidden = naVitrine.length === 0;
  qtdVitrine.textContent = naVitrine.length;
  notaVitrine.textContent =
    `${naVitrine.length} ${naVitrine.length === 1 ? 'destaque' : 'destaques'}` +
    (pausados ? ` · ${pausados} pausado${pausados > 1 ? 's' : ''}` : '') +
    (encerrados ? ` · ${encerrados} encerrado${encerrados > 1 ? 's' : ''} (já escondido${encerrados > 1 ? 's' : ''} da vitrine)` : '') +
    (mudaram ? ` · ${mudaram} com preço diferente do salvo` : '');
  const botaoEncerrados = document.querySelector('#remover-encerrados');
  botaoEncerrados.hidden = !encerrados;
  botaoEncerrados.textContent = `Remover ${encerrados} encerrado${encerrados > 1 ? 's' : ''}`;

  const termo = document.querySelector('#busca-destaques').value.trim().toLowerCase();
  const filtro = FILTROS[document.querySelector('#filtro-destaques').value] || FILTROS[''];
  const visiveis = naVitrine.filter((p) => filtro(p) && (!termo || p.titulo.toLowerCase().includes(termo)));
  listaVitrine.innerHTML = naVitrine.length
    ? visiveis.length
      ? visiveis.map((p) => linhaVitrine(p, naVitrine.indexOf(p), naVitrine.length)).join('')
      : '<tr><td colspan="7">Nenhum destaque com esse filtro.</td></tr>'
    : '<tr><td colspan="7">Nenhum destaque ainda. Use "Averiguar promoções" ou "＋ Adicionar".</td></tr>';
  document.dispatchEvent(new CustomEvent('destaques-mudaram', { detail: naVitrine }));
}

// Rodízio de 24 h gravado no Firestore (só o admin pode escrever): roda ao abrir o painel e a cada 5 min
let rodando = false;
async function rodarRodizio() {
  if (rodando) return;
  rodando = true;
  try {
    const conferidos = await conferirDestaquesAoVivo((await listarDestaques()).filter((d) => d.ativo));
    const trocas = await executarRodizio(conferidos.filter((d) => d.emPromocao));
    if (trocas.length) {
      notaVitrine.textContent = `Rodízio: ${trocas.map((t) => `“${t.saiu.titulo}” → “${t.entrou.titulo}”`).join(', ')}`;
      await carregarVitrineAdmin({ semRodizio: true });
      renderizarChegando();
    }
  } catch (erro) {
    console.warn('Rodízio não rodou agora', erro);
  } finally {
    rodando = false;
  }
}

export async function carregarVitrineAdmin({ semRodizio = false } = {}) {
  if (!semRodizio) rodarRodizio();
  try {
    naVitrine = await listarDestaques();
    desenharTabela();
    // confere a situação de agora sem gravar nada (o admin decide o que salvar ou remover)
    const conferidos = await conferirDestaquesAoVivo(naVitrine);
    naVitrine = conferidos.map((c, i) => ({ ...c, salvo: naVitrine[i] }));
    desenharTabela();
  } catch (erro) {
    console.error(erro);
    if (!naVitrine.length) listaVitrine.innerHTML = '<tr><td colspan="7" class="mensagem erro">Erro ao carregar os destaques.</td></tr>';
  }
}

async function atualizarPreco(p) {
  const precos = await buscarPromocaoPorId(p.dealID);
  await atualizarDestaque(p.id, {
    precoNormal: precos.precoNormal,
    precoPromocional: precos.precoPromocional,
    desconto: precos.desconto,
  });
  return precos.emPromocao;
}

// ---------- Início ----------
export async function iniciarAveriguar() {
  await carregarContexto();
  selectLoja.insertAdjacentHTML(
    'beforeend',
    [...contexto.lojas.values()].map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
  );

  formFiltros.addEventListener('submit', (e) => {
    e.preventDefault();
    buscarChegando();
  });
  formFiltros.elements.soNovas.addEventListener('change', renderizarChegando);

  // atalhos e filtros
  document.querySelector('#atalhos-averiguar').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-atalho]');
    if (!chip) return;
    const atalho = ATALHOS.find((a) => a.id === chip.dataset.atalho);
    const jaAtivo = chip.getAttribute('aria-pressed') === 'true';
    aplicarFiltros(jaAtivo ? {} : atalho.filtros);
    buscarChegando();
  });
  formFiltros.addEventListener('change', (e) => {
    if (e.target.name === 'soNovas') return;
    if (e.target.name !== 'termo') buscarChegando();
  });
  document.querySelector('#limpar-averiguar').addEventListener('click', () => {
    aplicarFiltros({});
    buscarChegando();
  });
  document.querySelector('#mais-averiguar').addEventListener('click', () => {
    pagina += 1;
    buscarChegando({ mais: true });
  });

  // C — destacar: janela com os destaques atuais lado a lado para escolher qual substituir
  listaAveriguar.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-aprovar]');
    if (!botao) return;
    const promo = chegando.find((p) => p.dealID === botao.dataset.aprovar);
    botao.disabled = true;
    const texto = botao.textContent;
    botao.textContent = 'Abrindo…';
    const destacou = await abrirDestacar(promo, await destaquesComoNaVitrine());
    botao.textContent = texto;
    if (destacou) {
      await carregarVitrineAdmin();
      renderizarChegando();
    } else botao.disabled = false;
  });

  document.querySelector('#busca-destaques').addEventListener('input', desenharTabela);
  document.querySelector('#filtro-destaques').addEventListener('change', desenharTabela);

  // onde aparece (banner, faixa ou ambos)
  listaVitrine.addEventListener('change', async (e) => {
    const select = e.target.closest('[data-exibir]');
    if (!select) return;
    select.disabled = true;
    try {
      await definirExibicaoDestaque(select.dataset.exibir, select.value);
      const p = naVitrine.find((x) => x.id === select.dataset.exibir);
      if (p) p.exibir = select.value;
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível salvar. Tente de novo.');
    } finally {
      select.disabled = false;
    }
  });

  // U — atualizar preço / D — remover
  listaVitrine.addEventListener('click', async (e) => {
    const mover = e.target.closest('[data-mover]');
    if (mover) {
      const i = naVitrine.findIndex((p) => p.id === mover.dataset.id);
      const j = i + Number(mover.dataset.mover);
      if (i < 0 || j < 0 || j >= naVitrine.length) return;
      [naVitrine[i], naVitrine[j]] = [naVitrine[j], naVitrine[i]];
      desenharTabela();
      try {
        await salvarOrdemDestaques(naVitrine.map((p) => p.id));
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível salvar a nova ordem.');
        await carregarVitrineAdmin();
      }
      return;
    }
    const botaoImagens = e.target.closest('[data-imagens]');
    if (botaoImagens) {
      const p = naVitrine.find((x) => x.id === botaoImagens.dataset.imagens);
      const salvo = await abrirTrocarImagens(p);
      if (salvo) {
        Object.assign(p, salvo);
        desenharTabela();
      }
      return;
    }
    const botaoVideo = e.target.closest('[data-video]');
    if (botaoVideo) {
      const p = naVitrine.find((x) => x.id === botaoVideo.dataset.video);
      const novo = prompt(
        `Vídeo de "${p.titulo}" (toca sem som quando passam o mouse).\nLink do YouTube, .mp4 ou .webm. Deixe vazio para usar o trailer da Steam.`,
        p.video || '',
      );
      if (novo === null) return;
      if (novo.trim() && !videoValido(novo)) return alert('Use um link do YouTube ou de um arquivo .mp4/.webm.');
      try {
        await definirVideoDestaque(p.id, novo);
        p.video = novo.trim();
        desenharTabela();
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível salvar o vídeo.');
      }
      return;
    }
    const fixar = e.target.closest('[data-fixar]');
    if (fixar) {
      const p = naVitrine.find((x) => x.id === fixar.dataset.fixar);
      fixar.disabled = true;
      try {
        await definirFixoDestaque(p.id, !p.fixo);
        p.fixo = !p.fixo;
        desenharTabela();
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível mudar. Tente de novo.');
        fixar.disabled = false;
      }
      return;
    }
    const pausar = e.target.closest('[data-pausar]');
    if (pausar) {
      const p = naVitrine.find((x) => x.id === pausar.dataset.pausar);
      pausar.disabled = true;
      try {
        await alternarAtivoDestaque(p.id, !p.ativo);
        p.ativo = !p.ativo;
        desenharTabela();
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível mudar. Tente de novo.');
        pausar.disabled = false;
      }
      return;
    }
    const editar = e.target.closest('[data-editar]');
    if (editar) {
      editarManual(naVitrine.find((x) => x.id === editar.dataset.editar));
      document.querySelector('[data-aba="adicionar"]').click();
      return;
    }
    const comentar = e.target.closest('[data-comentar]');
    if (comentar) {
      const promo = naVitrine.find((p) => p.id === comentar.dataset.comentar);
      const novo = await abrirEditorComentario({ titulo: promo.titulo, valor: promo.comentario || '' });
      if (novo === null) return;
      try {
        await editarComentarioDestaque(promo.id, novo);
        await carregarVitrineAdmin();
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível salvar o comentário.');
      }
      return;
    }
    const botao = e.target.closest('[data-atualizar], [data-remover]');
    if (!botao) return;
    const id = botao.dataset.atualizar || botao.dataset.remover;
    const promo = naVitrine.find((p) => p.id === id);
    if (!promo) return;
    botao.disabled = true;
    try {
      if (botao.dataset.remover) {
        if (!confirm(`Tirar "${promo.titulo}" dos destaques?`)) {
          botao.disabled = false;
          return;
        }
        await removerDestaque(id);
      } else {
        const continua = await atualizarPreco(promo);
        if (!continua && confirm(`A promoção de "${promo.titulo}" terminou. Tirar dos destaques?`)) {
          await removerDestaque(id);
        }
      }
      await carregarVitrineAdmin();
      renderizarChegando();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível concluir. Tente novamente.');
      botao.disabled = false;
    }
  });

  botaoAtualizarTodas.addEventListener('click', async () => {
    botaoAtualizarTodas.disabled = true;
    let encerradas = 0;
    try {
      // uma de cada vez, para não sobrecarregar a API pública
      const daApi = naVitrine.filter((p) => !p.manual);
      for (const [i, p] of daApi.entries()) {
        botaoAtualizarTodas.textContent = `Atualizando ${i + 1}/${daApi.length}…`;
        if (!(await atualizarPreco(p))) encerradas += 1;
      }
      await carregarVitrineAdmin();
      if (encerradas) alert(`${encerradas} ${encerradas === 1 ? 'promoção terminou' : 'promoções terminaram'}. Elas aparecem como "Encerrada"; remova-as se quiser.`);
    } catch (erro) {
      console.error(erro);
      alert('Parte dos preços não pôde ser atualizada. Tente novamente.');
    } finally {
      botaoAtualizarTodas.disabled = false;
      botaoAtualizarTodas.textContent = 'Atualizar todos os preços';
    }
  });

  const botaoEncerrados = document.querySelector('#remover-encerrados');
  botaoEncerrados.addEventListener('click', async () => {
    const encerrados = naVitrine.filter((p) => p.emPromocao === false);
    if (!encerrados.length || !confirm(`Remover ${encerrados.length} destaque(s) cuja promoção acabou?`)) return;
    botaoEncerrados.disabled = true;
    try {
      await Promise.all(encerrados.map((p) => removerDestaque(p.id)));
      await carregarVitrineAdmin();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível remover todos. Tente de novo.');
    } finally {
      botaoEncerrados.disabled = false;
    }
  });

  const botaoSincronizar = document.querySelector('#sincronizar');
  botaoSincronizar.addEventListener('click', async () => {
    botaoSincronizar.disabled = true;
    try {
      const total = await sincronizarCatalogo({
        paginas: 10,
        aoProgredir: (feitas, de, jogos) => (botaoSincronizar.textContent = `Sincronizando ${feitas}/${de} (${jogos} jogos)…`),
      });
      alert(`${total} promoções gravadas no catálogo Games.`);
    } catch (erro) {
      console.error(erro);
      alert('A sincronização parou no meio. O que já foi gravado fica salvo; tente de novo mais tarde.');
    } finally {
      botaoSincronizar.disabled = false;
      botaoSincronizar.textContent = 'Sincronizar catálogo Games';
    }
  });

  iniciarAutomatico();
  await carregarVitrineAdmin();
  setInterval(rodarRodizio, 5 * 60 * 1000);
  await buscarChegando();
}

// ---------- Adicionar automaticamente ----------
async function iniciarAutomatico() {
  const form = document.querySelector('#form-auto');
  const nota = document.querySelector('#nota-auto');
  const selMetrica = document.querySelector('#auto-metrica');
  selMetrica.innerHTML = Object.entries(METRICAS)
    .map(([id, m]) => `<option value="${id}">${m.rotulo}</option>`)
    .join('');
  document.querySelector('#auto-loja').insertAdjacentHTML(
    'beforeend',
    [...contexto.lojas.values()].map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
  );
  const config = await lerConfigRodizio();
  selMetrica.value = METRICAS[config.metrica] ? config.metrica : METRICA_PADRAO;
  nota.textContent = `Rodízio usando: ${METRICAS[selMetrica.value].rotulo}`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    nota.textContent = 'Escolhendo os melhores…';
    try {
      const atuais = (await listarDestaques()).filter((d) => d.ativo);
      const novos = await adicionarAutomaticamente(atuais, {
        metrica: form.elements.metrica.value,
        quantidade: Number(form.elements.quantidade.value),
        lojaId: form.elements.loja.value,
      });
      nota.textContent = novos.length
        ? `✓ ${novos.length} adicionado${novos.length > 1 ? 's' : ''}: ${novos.map((p) => p.titulo).join(', ')}`
        : 'Nenhum jogo novo nessa métrica (os melhores já estão nos destaques).';
      await carregarVitrineAdmin({ semRodizio: true });
      renderizarChegando();
    } catch (erro) {
      console.error(erro);
      nota.textContent = 'Não foi possível adicionar agora. Tente de novo.';
    } finally {
      botao.disabled = false;
    }
  });
}
