// Aba "Recomendações diárias": CRUD do catálogo (jogos, notícias e eventos gamer)
import {
  TIPOS,
  criarRecomendacao,
  listarRecomendacoes,
  atualizarRecomendacao,
  excluirRecomendacao,
  validarRecomendacao,
} from './recomendacoes.js';
import { esc, hojeISO, formatarDiaISO } from './util.js';

const form = document.querySelector('#form-rec');
const tituloForm = document.querySelector('#titulo-form-rec');
const msg = document.querySelector('#msg-rec');
const botaoSalvar = document.querySelector('#salvar-rec');
const botaoCancelar = document.querySelector('#cancelar-rec');
const lista = document.querySelector('#lista-recs');
const nota = document.querySelector('#nota-recs');

let recs = [];
let editandoId = null;

function mostrar(texto, tipo = '') {
  msg.textContent = texto;
  msg.className = `mensagem ${tipo}`;
}

function modoCadastro() {
  editandoId = null;
  form.reset();
  form.elements.data.value = hojeISO();
  tituloForm.textContent = 'Nova recomendação';
  botaoSalvar.textContent = 'Publicar recomendação';
  botaoCancelar.hidden = true;
}

function modoEdicao(r) {
  editandoId = r.id;
  ['tipo', 'titulo', 'descricao', 'link', 'imagem', 'data'].forEach((c) => (form.elements[c].value = r[c] || ''));
  tituloForm.textContent = 'Editar recomendação';
  botaoSalvar.textContent = 'Salvar alterações';
  botaoCancelar.hidden = false;
  mostrar('');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function linha(r) {
  const hoje = r.data === hojeISO();
  return `
    <tr>
      <td>${formatarDiaISO(r.data)}${hoje ? ' <span class="status ok">hoje</span>' : ''}</td>
      <td><span class="tipo tipo-${esc(r.tipo)}">${esc(TIPOS[r.tipo] || r.tipo)}</span></td>
      <td><a href="${esc(r.link)}" target="_blank" rel="noopener"><strong>${esc(r.titulo)}</strong></a>
          ${r.descricao ? `<br /><span class="secao-nota">${esc(r.descricao)}</span>` : ''}</td>
      <td>
        <div class="acoes-linha">
          <button class="botao secundario pequeno" type="button" data-editar="${esc(r.id)}">Editar</button>
          <button class="botao perigo pequeno" type="button" data-excluir="${esc(r.id)}">Excluir</button>
        </div>
      </td>
    </tr>`;
}

export async function carregarRecomendacoesAdmin() {
  try {
    recs = await listarRecomendacoes(100);
    const deHoje = recs.filter((r) => r.data === hojeISO()).length;
    nota.textContent = `${deHoje} para hoje · ${recs.length} no catálogo`;
    lista.innerHTML = recs.length
      ? recs.map(linha).join('')
      : '<tr><td colspan="4">Nenhuma recomendação ainda. Publique a primeira ao lado.</td></tr>';
  } catch (erro) {
    console.error(erro);
    lista.innerHTML = '<tr><td colspan="4" class="mensagem erro">Erro ao carregar o catálogo.</td></tr>';
  }
}

export function iniciarRecomendacoesAdmin() {
  modoCadastro();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(['tipo', 'titulo', 'descricao', 'link', 'imagem', 'data'].map((c) => [c, form.elements[c].value]));
    const erros = validarRecomendacao(dados);
    if (erros.length) {
      mostrar(erros.join(' '), 'erro');
      return;
    }
    botaoSalvar.disabled = true;
    try {
      if (editandoId) {
        await atualizarRecomendacao(editandoId, dados);
        mostrar('Recomendação atualizada.', 'ok');
      } else {
        await criarRecomendacao(dados);
        mostrar('Recomendação publicada.', 'ok');
      }
      modoCadastro();
      await carregarRecomendacoesAdmin();
    } catch (erro) {
      console.error(erro);
      mostrar('Não foi possível salvar. Confira se sua conta está na coleção "admins".', 'erro');
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  botaoCancelar.addEventListener('click', () => {
    modoCadastro();
    mostrar('');
  });

  lista.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-editar], [data-excluir]');
    if (!botao) return;
    const r = recs.find((x) => x.id === (botao.dataset.editar || botao.dataset.excluir));
    if (!r) return;
    if (botao.dataset.editar) {
      modoEdicao(r);
      return;
    }
    if (!confirm(`Excluir "${r.titulo}" do catálogo?`)) return;
    try {
      await excluirRecomendacao(r.id);
      if (editandoId === r.id) modoCadastro();
      await carregarRecomendacoesAdmin();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível excluir. Tente novamente.');
    }
  });
}
