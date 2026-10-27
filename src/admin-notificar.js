// Aba "Inspeção diária": CRUD do catálogo "notificar" e verificação das promoções novas de cada alerta
import {
  criarAlerta,
  listarAlertas,
  atualizarAlerta,
  alternarAlerta,
  excluirAlerta,
  registrarInspecao,
  validarAlerta,
  inspecionadoHoje,
} from './notificar.js';
import { recomendar } from './recomendacoes.js';
import { buscarPromocoes } from './api.js';
import { contexto, carregarContexto, precoEmReal, dolarParaReal, nomeDaLoja } from './contexto.js';
import { formatarReal, esc, IMAGEM_PADRAO } from './util.js';

const form = document.querySelector('#form-alerta');
const tituloForm = document.querySelector('#titulo-form-alerta');
const msg = document.querySelector('#msg-alerta');
const botaoSalvar = document.querySelector('#salvar-alerta');
const botaoCancelar = document.querySelector('#cancelar-alerta');
const selectLoja = document.querySelector('#alerta-loja');
const listaEl = document.querySelector('#lista-alertas');
const statusEl = document.querySelector('#status-inspecao');
const botaoConcluir = document.querySelector('#concluir-inspecao');
const botaoAtualizar = document.querySelector('#atualizar-inspecao');
const contadorAba = document.querySelector('#contador-novas');

let alertas = [];
const resultados = new Map(); // id do alerta → { promos, novas: Set, erro }
let editandoId = null;
let verificando = false;

// ---------- Inspeção: busca as promoções de cada alerta e separa as novas ----------
async function verificarAlerta(alerta) {
  try {
    let promos = await buscarPromocoes({ termo: alerta.termo, lojaId: alerta.lojaId, limite: 20 });
    if (alerta.precoMaximo) {
      promos = promos.filter((p) => {
        const real = dolarParaReal(p.precoPromocional);
        return real === null || real <= alerta.precoMaximo;
      });
    }
    const vistos = new Set(alerta.vistos || []);
    const novas = new Set(promos.filter((p) => !vistos.has(p.id)).map((p) => p.id));
    // novas primeiro, depois maior desconto
    promos.sort((a, b) => novas.has(b.id) - novas.has(a.id) || b.desconto - a.desconto);
    resultados.set(alerta.id, { promos, novas, erro: null });
  } catch (erro) {
    console.error(erro);
    resultados.set(alerta.id, { promos: [], novas: new Set(), erro: 'Não foi possível consultar a CheapShark.' });
  }
}

async function verificarTodos() {
  verificando = true;
  botaoConcluir.disabled = true;
  resultados.clear();
  renderizar();
  // Um alerta por vez, para não sobrecarregar a API pública
  for (const alerta of alertas.filter((a) => a.ativo)) {
    await verificarAlerta(alerta);
    renderizar();
  }
  verificando = false;
  renderizar();
}

export async function carregarNotificar() {
  try {
    await carregarContexto();
    alertas = await listarAlertas();
    await verificarTodos();
  } catch (erro) {
    console.error(erro);
    listaEl.innerHTML = '<div class="aviso erro">Erro ao carregar os alertas.</div>';
  }
}

// ---------- Renderização ----------
function linhaPromo(p, ehNova) {
  return `
    <div class="promo-linha${ehNova ? ' nova' : ''}">
      <img src="${esc(p.imagem)}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
      <div class="promo-info">
        <a href="${esc(p.link)}" target="_blank" rel="noopener"><strong>${esc(p.titulo)}</strong></a>
        <span class="secao-nota">${esc(nomeDaLoja(p.lojaId))} · -${p.desconto}%</span>
      </div>
      <div class="promo-preco">
        <span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>
        <strong>${precoEmReal(p.precoPromocional)}</strong>
      </div>
      ${ehNova ? '<span class="selo-nova">Nova</span>' : '<span></span>'}
      <button class="botao secundario pequeno" data-acao="recomendar" data-deal="${esc(p.id)}">Recomendar</button>
    </div>`;
}

function cartaoAlerta(a) {
  const r = resultados.get(a.id);
  const filtros = [
    a.precoMaximo ? `até ${formatarReal(a.precoMaximo)}` : 'qualquer preço',
    a.lojaId ? nomeDaLoja(a.lojaId) : 'qualquer loja',
    a.ultimaInspecao ? `inspecionado em ${a.ultimaInspecao.toDate().toLocaleDateString('pt-BR')}` : 'nunca inspecionado',
  ].join(' · ');

  let corpo;
  if (!a.ativo) corpo = '<p class="secao-nota">Alerta pausado: não entra na inspeção.</p>';
  else if (!r) corpo = '<p class="secao-nota">Verificando promoções…</p>';
  else if (r.erro) corpo = `<p class="mensagem erro">${r.erro}</p>`;
  else if (!r.promos.length) corpo = '<p class="secao-nota">Nenhuma promoção encontrada agora.</p>';
  else corpo = r.promos.map((p) => linhaPromo(p, r.novas.has(p.id))).join('');

  const novas = r?.novas.size || 0;
  return `
    <article class="alerta${a.ativo ? '' : ' pausado'}" data-alerta="${a.id}">
      <header class="alerta-cabeca">
        <div>
          <h3>${esc(a.termo)} ${novas ? `<span class="contador">${novas} nova${novas > 1 ? 's' : ''}</span>` : ''}</h3>
          <p class="secao-nota">${esc(filtros)}</p>
        </div>
        <div class="acoes-linha">
          <button class="botao secundario pequeno" data-acao="editar" data-id="${a.id}">Editar</button>
          <button class="botao secundario pequeno" data-acao="alternar" data-id="${a.id}">${a.ativo ? 'Pausar' : 'Ativar'}</button>
          <button class="botao perigo pequeno" data-acao="excluir" data-id="${a.id}">Excluir</button>
        </div>
      </header>
      <div class="alerta-corpo">${corpo}</div>
    </article>`;
}

function renderizar() {
  const ativos = alertas.filter((a) => a.ativo);
  const totalNovas = [...resultados.values()].reduce((s, r) => s + r.novas.size, 0);
  const pendente = ativos.some((a) => !inspecionadoHoje(a));

  if (!alertas.length) {
    statusEl.textContent = 'Nenhum alerta cadastrado.';
  } else if (verificando) {
    statusEl.textContent = `Verificando ${ativos.length} ${ativos.length === 1 ? 'alerta' : 'alertas'} na CheapShark…`;
  } else {
    const situacao = pendente ? 'Inspeção de hoje pendente' : 'Inspeção de hoje concluída';
    statusEl.innerHTML = `<strong class="${pendente ? 'pendente' : 'concluida'}">${situacao}</strong> · ${totalNovas} ${
      totalNovas === 1 ? 'promoção nova' : 'promoções novas'
    }`;
  }

  contadorAba.hidden = totalNovas === 0;
  contadorAba.textContent = totalNovas;
  botaoConcluir.disabled = verificando || !ativos.length;

  listaEl.innerHTML = alertas.length
    ? alertas.map(cartaoAlerta).join('')
    : '<div class="aviso">Cadastre um alerta ao lado para começar a inspeção diária.</div>';
}

// ---------- Formulário: C / U ----------
function lerFormulario() {
  const f = new FormData(form);
  return {
    termo: f.get('termo') || '',
    precoMaximo: f.get('precoMaximo') || '',
    lojaId: f.get('lojaId') || '',
    ativo: f.get('ativo') === 'on',
  };
}

function mostrarMensagem(texto, tipo) {
  msg.textContent = texto;
  msg.className = `mensagem ${tipo || ''}`;
}

function modoCadastro() {
  editandoId = null;
  form.reset();
  tituloForm.textContent = 'Novo alerta';
  botaoSalvar.textContent = 'Cadastrar alerta';
  botaoCancelar.hidden = true;
}

function modoEdicao(a) {
  editandoId = a.id;
  form.elements.termo.value = a.termo;
  form.elements.precoMaximo.value = a.precoMaximo ?? '';
  form.elements.lojaId.value = a.lojaId || '';
  form.elements.ativo.checked = a.ativo;
  tituloForm.textContent = 'Editar alerta';
  botaoSalvar.textContent = 'Salvar alterações';
  botaoCancelar.hidden = false;
  mostrarMensagem('');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.termo.focus();
}

async function preencherLojas() {
  await carregarContexto();
  selectLoja.insertAdjacentHTML(
    'beforeend',
    [...contexto.lojas.values()].map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
  );
}

export function iniciarNotificar() {
  preencherLojas();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = lerFormulario();
    const erros = validarAlerta(dados);
    if (erros.length) {
      mostrarMensagem(erros.join(' '), 'erro');
      return;
    }
    botaoSalvar.disabled = true;
    try {
      if (editandoId) {
        await atualizarAlerta(editandoId, dados);
        mostrarMensagem('Alerta atualizado.', 'ok');
      } else {
        await criarAlerta(dados);
        mostrarMensagem('Alerta cadastrado. Verificando promoções…', 'ok');
      }
      modoCadastro();
      await carregarNotificar();
    } catch (erro) {
      console.error(erro);
      mostrarMensagem('Não foi possível salvar o alerta.', 'erro');
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  botaoCancelar.addEventListener('click', () => {
    modoCadastro();
    mostrarMensagem('');
  });

  botaoAtualizar.addEventListener('click', () => {
    if (!verificando) verificarTodos();
  });

  // Concluir inspeção: tudo o que apareceu hoje passa a contar como visto
  botaoConcluir.addEventListener('click', async () => {
    botaoConcluir.disabled = true;
    try {
      const ativos = alertas.filter((a) => a.ativo && resultados.has(a.id) && !resultados.get(a.id).erro);
      await Promise.all(ativos.map((a) => registrarInspecao(a, resultados.get(a.id).promos.map((p) => p.id))));
      alertas = await listarAlertas();
      await verificarTodos();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível registrar a inspeção. Tente novamente.');
      botaoConcluir.disabled = false;
    }
  });

  // Ações dentro da lista: editar / pausar / excluir alerta (U, D) e recomendar promoção
  listaEl.addEventListener('click', async (e) => {
    const botao = e.target.closest('button[data-acao]');
    if (!botao) return;
    const acao = botao.dataset.acao;

    if (acao === 'recomendar') {
      const alertaId = botao.closest('[data-alerta]').dataset.alerta;
      const promo = resultados.get(alertaId)?.promos.find((p) => p.id === botao.dataset.deal);
      if (!promo) return;
      const comentario = prompt(`Por que você recomenda "${promo.titulo}"? (opcional)`, '');
      if (comentario === null) return;
      botao.disabled = true;
      try {
        const { duplicada } = await recomendar(promo, comentario.slice(0, 200));
        botao.textContent = duplicada ? 'Já recomendado' : 'Recomendado ✓';
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível recomendar. Tente novamente.');
        botao.disabled = false;
      }
      return;
    }

    const alerta = alertas.find((a) => a.id === botao.dataset.id);
    if (!alerta) return;
    if (acao === 'editar') {
      modoEdicao(alerta);
      return;
    }
    botao.disabled = true;
    try {
      if (acao === 'alternar') {
        await alternarAlerta(alerta.id, !alerta.ativo);
      } else if (acao === 'excluir') {
        if (!confirm(`Excluir o alerta "${alerta.termo}"?`)) {
          botao.disabled = false;
          return;
        }
        await excluirAlerta(alerta.id);
        if (editandoId === alerta.id) modoCadastro();
      }
      alertas = await listarAlertas();
      await verificarTodos();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível concluir a ação. Tente novamente.');
      botao.disabled = false;
    }
  });
}
