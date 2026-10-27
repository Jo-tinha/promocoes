// Aba "Ofertas oficiais": CRUD da coleção "ofertas"
import {
  cadastrarOferta,
  listarOfertas,
  atualizarOferta,
  alternarAtiva,
  excluirOferta,
  validarOferta,
  ofertaVigente,
} from './ofertas.js';
import { formatarReal, esc, formatarData, IMAGEM_PADRAO } from './util.js';

const formOferta = document.querySelector('#form-oferta');
const msgForm = document.querySelector('#msg-form');
const tituloForm = document.querySelector('#titulo-form');
const botaoSalvar = document.querySelector('#botao-salvar');
const botaoCancelar = document.querySelector('#cancelar');
const listaOfertas = document.querySelector('#lista-ofertas');
const contagem = document.querySelector('#contagem');

let ofertas = [];
let editandoId = null; // id da oferta em edição; null = cadastro novo

// ---------- R — Consultar ----------
function linhaOferta(o) {
  const vigente = ofertaVigente(o);
  const rotulo = vigente ? 'Ativa' : o.ativa ? 'Vencida' : 'Inativa';
  return `
    <tr>
      <td><img class="miniatura" src="${esc(o.imagemUrl) || IMAGEM_PADRAO}" alt="" onerror="this.src='${IMAGEM_PADRAO}'" /></td>
      <td><strong>${esc(o.titulo)}</strong><br /><span class="secao-nota">${esc(o.categoria)}</span></td>
      <td><span class="preco-antigo">${formatarReal(o.precoOriginal)}</span><br />${formatarReal(o.precoOferta)}</td>
      <td>${formatarData(o.validoAte?.toDate())}</td>
      <td><span class="status ${vigente ? 'ativa' : 'inativa'}">${rotulo}</span></td>
      <td>
        <div class="acoes-linha">
          <button class="botao secundario pequeno" data-acao="editar" data-id="${o.id}">Editar</button>
          <button class="botao secundario pequeno" data-acao="alternar" data-id="${o.id}">${o.ativa ? 'Desativar' : 'Ativar'}</button>
          <button class="botao perigo pequeno" data-acao="excluir" data-id="${o.id}">Excluir</button>
        </div>
      </td>
    </tr>`;
}

export async function carregarOfertas() {
  try {
    ofertas = await listarOfertas();
    contagem.textContent = `${ofertas.length} ${ofertas.length === 1 ? 'oferta' : 'ofertas'}`;
    listaOfertas.innerHTML = ofertas.length
      ? ofertas.map(linhaOferta).join('')
      : '<tr><td colspan="6">Nenhuma oferta cadastrada ainda. Use o formulário ao lado.</td></tr>';
  } catch (erro) {
    console.error(erro);
    listaOfertas.innerHTML = '<tr><td colspan="6" class="mensagem erro">Erro ao carregar as ofertas.</td></tr>';
  }
}

// ---------- C / U — Cadastrar e Atualizar ----------
function lerFormulario() {
  const f = new FormData(formOferta);
  return {
    titulo: f.get('titulo') || '',
    descricao: f.get('descricao') || '',
    categoria: f.get('categoria') || '',
    precoOriginal: f.get('precoOriginal'),
    precoOferta: f.get('precoOferta'),
    imagemUrl: f.get('imagemUrl') || '',
    validoAte: f.get('validoAte') || '',
    ativa: f.get('ativa') === 'on',
  };
}

function mostrarMensagem(texto, tipo) {
  msgForm.textContent = texto;
  msgForm.className = `mensagem ${tipo || ''}`;
}

function modoCadastro() {
  editandoId = null;
  formOferta.reset();
  tituloForm.textContent = 'Nova oferta';
  botaoSalvar.textContent = 'Cadastrar oferta';
  botaoCancelar.hidden = true;
}

function dataParaInput(data) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function modoEdicao(o) {
  editandoId = o.id;
  const campos = formOferta.elements;
  campos.titulo.value = o.titulo;
  campos.descricao.value = o.descricao || '';
  campos.categoria.value = o.categoria;
  campos.precoOriginal.value = o.precoOriginal;
  campos.precoOferta.value = o.precoOferta;
  campos.imagemUrl.value = o.imagemUrl || '';
  campos.validoAte.value = o.validoAte ? dataParaInput(o.validoAte.toDate()) : '';
  campos.ativa.checked = o.ativa;
  tituloForm.textContent = 'Editar oferta';
  botaoSalvar.textContent = 'Salvar alterações';
  botaoCancelar.hidden = false;
  mostrarMensagem('');
  formOferta.scrollIntoView({ behavior: 'smooth', block: 'start' });
  campos.titulo.focus();
}

export function iniciarOfertas() {
  formOferta.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = lerFormulario();
    const erros = validarOferta(dados);
    if (erros.length) {
      mostrarMensagem(erros.join(' '), 'erro');
      return;
    }
    botaoSalvar.disabled = true;
    try {
      if (editandoId) {
        await atualizarOferta(editandoId, dados);
        mostrarMensagem('Oferta atualizada.', 'ok');
      } else {
        await cadastrarOferta(dados);
        mostrarMensagem('Oferta cadastrada.', 'ok');
      }
      modoCadastro();
      await carregarOfertas();
    } catch (erro) {
      console.error(erro);
      mostrarMensagem('Não foi possível salvar. Verifique sua conexão e as regras do Firestore.', 'erro');
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  botaoCancelar.addEventListener('click', () => {
    modoCadastro();
    mostrarMensagem('');
  });

  // ---------- Ações da tabela: editar, ativar/desativar, D — Excluir ----------
  listaOfertas.addEventListener('click', async (e) => {
    const botao = e.target.closest('button[data-acao]');
    if (!botao) return;
    const oferta = ofertas.find((o) => o.id === botao.dataset.id);
    if (!oferta) return;

    if (botao.dataset.acao === 'editar') {
      modoEdicao(oferta);
      return;
    }

    botao.disabled = true;
    try {
      if (botao.dataset.acao === 'alternar') {
        await alternarAtiva(oferta.id, !oferta.ativa);
      } else if (botao.dataset.acao === 'excluir') {
        if (!confirm(`Excluir a oferta "${oferta.titulo}"? Essa ação não pode ser desfeita.`)) {
          botao.disabled = false;
          return;
        }
        await excluirOferta(oferta.id);
        if (editandoId === oferta.id) modoCadastro();
      }
      await carregarOfertas();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível concluir a ação. Tente novamente.');
      botao.disabled = false;
    }
  });
}
