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
} from './destaques.js';
import { editarManual } from './admin-adicionar.js';
import { contexto, carregarContexto, precoEmReal, nomeDaLoja } from './contexto.js';
import { esc, IMAGEM_PADRAO, formatarReal } from './util.js';
import { sincronizarCatalogo } from './catalogo.js';

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

async function buscarChegando() {
  const f = formFiltros.elements;
  listaAveriguar.innerHTML = '<div class="aviso">Consultando a CheapShark…</div>';
  try {
    chegando = await buscarPromocoes({ termo: f.termo.value.trim(), lojaId: f.loja.value, ordem: f.ordem.value, limite: 60 });
    renderizarChegando();
  } catch (erro) {
    console.error(erro);
    listaAveriguar.innerHTML = '<div class="aviso erro">Não foi possível consultar a CheapShark agora.</div>';
  }
}

// ---------- Na vitrine ----------
// situação de agora (vinda da conferência ao vivo); undefined = ainda conferindo
function situacao(p) {
  if (!p.ativo) return '<span class="status off">Pausado</span>';
  if (p.emPromocao === undefined) return '<span class="status off">conferindo…</span>';
  if (!p.emPromocao) return `<span class="status encerrada">${p.manual ? 'Data passou' : 'Encerrada'}</span>`;
  if (p.precoMudou) return '<span class="status mudou">Preço mudou</span>';
  if (p.manual && p.termina) return `<span class="status ok">Até ${p.termina.split('-').reverse().join('/')}</span>`;
  return '<span class="status ok">No ar</span>';
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
      <td><img class="miniatura" src="${esc(p.imagem)}" alt="" onerror="this.src='${IMAGEM_PADRAO}'" /></td>
      <td><a href="${esc(p.link)}" target="_blank" rel="noopener"><strong>${esc(p.titulo)}</strong></a><br /><span class="secao-nota">${origem}${p.comentario ? ` · “${esc(p.comentario)}”` : ''}</span></td>
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
              : `<button class="botao secundario pequeno" type="button" data-comentar="${esc(p.id)}">Comentário</button>
                 <button class="botao secundario pequeno" type="button" data-atualizar="${esc(p.id)}">${mudou ? 'Salvar preço novo' : 'Atualizar preço'}</button>`
          }
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

export async function carregarVitrineAdmin() {
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

  // C — aprovar
  listaAveriguar.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-aprovar]');
    if (!botao) return;
    const promo = chegando.find((p) => p.dealID === botao.dataset.aprovar);
    botao.disabled = true;
    const comentario = prompt(`Por que "${promo.titulo}" merece destaque? (opcional, aparece no cartão)`, '');
    if (comentario === null) {
      botao.disabled = false;
      return;
    }
    try {
      await destacar(promo, comentario.slice(0, 140));
      await carregarVitrineAdmin();
      renderizarChegando();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível destacar. Confira se sua conta está na coleção "admins".');
      botao.disabled = false;
    }
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
      const novo = prompt(`Comentário do destaque "${promo.titulo}" (aparece no cartão e no banner):`, promo.comentario || '');
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

  await carregarVitrineAdmin();
  await buscarChegando();
}
