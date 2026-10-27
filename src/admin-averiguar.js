// Abas "Averiguar promoções" e "Na vitrine": o admin decide quais promoções da CheapShark entram na aplicação
import { buscarPromocoes, buscarPromocaoPorId } from './api.js';
import { aprovarPromocao, listarPromocoes, atualizarPrecoPromocao, removerPromocao } from './promocoes.js';
import { contexto, carregarContexto, precoEmReal, nomeDaLoja } from './contexto.js';
import { esc, IMAGEM_PADRAO } from './util.js';

const formFiltros = document.querySelector('#filtros-averiguar');
const selectLoja = document.querySelector('#averiguar-loja');
const listaAveriguar = document.querySelector('#lista-averiguar');
const notaAveriguar = document.querySelector('#nota-averiguar');
const listaVitrine = document.querySelector('#lista-vitrine');
const notaVitrine = document.querySelector('#nota-vitrine');
const qtdVitrine = document.querySelector('#qtd-vitrine');
const botaoAtualizarTodas = document.querySelector('#atualizar-todas');

let chegando = []; // resultado atual da CheapShark
let naVitrine = []; // promoções aprovadas (Firestore)
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
            ? '<span class="status ok">Na vitrine</span>'
            : `<button class="botao pequeno" type="button" data-aprovar="${esc(p.dealID)}">Aprovar</button>`
        }
      </div>
    </div>`;
}

function renderizarChegando() {
  const ja = aprovadas();
  const soNovas = formFiltros.elements.soNovas.checked;
  const lista = chegando.filter((p) => !soNovas || !ja.has(p.dealID));
  const pendentes = chegando.filter((p) => !ja.has(p.dealID)).length;
  notaAveriguar.textContent = `${chegando.length} promoções encontradas · ${pendentes} ainda fora da vitrine.`;
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
function linhaVitrine(p) {
  const aprovada = p.aprovadoEm ? p.aprovadoEm.toDate().toLocaleDateString('pt-BR') : '—';
  const ativa = p.precoPromocional < p.precoNormal;
  return `
    <tr>
      <td><img class="miniatura" src="${esc(p.imagem)}" alt="" onerror="this.src='${IMAGEM_PADRAO}'" /></td>
      <td><a href="${esc(p.link)}" target="_blank" rel="noopener"><strong>${esc(p.titulo)}</strong></a><br /><span class="secao-nota">${esc(nomeDaLoja(p.lojaId))}</span></td>
      <td><span class="preco-antigo">${precoEmReal(p.precoNormal)}</span><br />${precoEmReal(p.precoPromocional)} <span class="secao-nota">(-${p.desconto}%)</span></td>
      <td>${aprovada}</td>
      <td><span class="status ${ativa ? 'ok' : 'off'}">${ativa ? 'Em promoção' : 'Encerrada'}</span></td>
      <td>
        <div class="acoes-linha">
          <button class="botao secundario pequeno" type="button" data-atualizar="${esc(p.id)}">Atualizar preço</button>
          <button class="botao perigo pequeno" type="button" data-remover="${esc(p.id)}">Remover</button>
        </div>
      </td>
    </tr>`;
}

export async function carregarVitrineAdmin() {
  try {
    naVitrine = await listarPromocoes();
    qtdVitrine.hidden = naVitrine.length === 0;
    qtdVitrine.textContent = naVitrine.length;
    notaVitrine.textContent = `${naVitrine.length} ${naVitrine.length === 1 ? 'promoção' : 'promoções'} visíveis para o público.`;
    listaVitrine.innerHTML = naVitrine.length
      ? naVitrine.map(linhaVitrine).join('')
      : '<tr><td colspan="6">Nenhuma promoção aprovada ainda. Use a aba "Averiguar promoções".</td></tr>';
  } catch (erro) {
    console.error(erro);
    listaVitrine.innerHTML = '<tr><td colspan="6" class="mensagem erro">Erro ao carregar a vitrine.</td></tr>';
  }
}

async function atualizarPreco(p) {
  const precos = await buscarPromocaoPorId(p.dealID);
  await atualizarPrecoPromocao(p.id, {
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
    try {
      await aprovarPromocao(promo);
      await carregarVitrineAdmin();
      renderizarChegando();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível aprovar. Confira se sua conta está na coleção "admins".');
      botao.disabled = false;
    }
  });

  // U — atualizar preço / D — remover
  listaVitrine.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-atualizar], [data-remover]');
    if (!botao) return;
    const id = botao.dataset.atualizar || botao.dataset.remover;
    const promo = naVitrine.find((p) => p.id === id);
    if (!promo) return;
    botao.disabled = true;
    try {
      if (botao.dataset.remover) {
        if (!confirm(`Remover "${promo.titulo}" da vitrine?`)) {
          botao.disabled = false;
          return;
        }
        await removerPromocao(id);
      } else {
        const continua = await atualizarPreco(promo);
        if (!continua && confirm(`A promoção de "${promo.titulo}" terminou. Remover da vitrine?`)) {
          await removerPromocao(id);
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
      for (const [i, p] of naVitrine.entries()) {
        botaoAtualizarTodas.textContent = `Atualizando ${i + 1}/${naVitrine.length}…`;
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

  await carregarVitrineAdmin();
  await buscarChegando();
}
