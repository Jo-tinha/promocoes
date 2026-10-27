import './style.css';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, firebaseConfigurado } from './firebase.js';
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

const telaLogin = document.querySelector('#tela-login');
const telaPainel = document.querySelector('#tela-painel');
const formLogin = document.querySelector('#form-login');
const erroLogin = document.querySelector('#erro-login');
const formOferta = document.querySelector('#form-oferta');
const msgForm = document.querySelector('#msg-form');
const tituloForm = document.querySelector('#titulo-form');
const botaoSalvar = document.querySelector('#botao-salvar');
const botaoCancelar = document.querySelector('#cancelar');
const listaOfertas = document.querySelector('#lista-ofertas');
const contagem = document.querySelector('#contagem');
const blocoUsuario = document.querySelector('#usuario');

let ofertas = [];
let editandoId = null; // id da oferta em edição; null = cadastro novo

// ---------- Autenticação ----------
if (!firebaseConfigurado) {
  telaLogin.hidden = false;
  erroLogin.textContent = 'Firebase não configurado. Preencha as variáveis de ambiente (veja o README).';
}

onAuthStateChanged(auth, (usuario) => {
  const logado = Boolean(usuario);
  telaLogin.hidden = logado;
  telaPainel.hidden = !logado;
  blocoUsuario.hidden = !logado;
  document.querySelector('#voltar').hidden = logado;
  if (logado) {
    document.querySelector('#usuario-email').textContent = usuario.email;
    carregarLista();
  }
});

const MENSAGENS_LOGIN = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
};

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  erroLogin.textContent = '';
  const dados = new FormData(formLogin);
  try {
    await signInWithEmailAndPassword(auth, dados.get('email'), dados.get('senha'));
    formLogin.reset();
  } catch (erro) {
    erroLogin.textContent = MENSAGENS_LOGIN[erro.code] || 'Não foi possível entrar. Tente novamente.';
  }
});

document.querySelector('#sair').addEventListener('click', () => signOut(auth));

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

async function carregarLista() {
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

function dataParaInput(data) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

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
    await carregarLista();
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
    await carregarLista();
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível concluir a ação. Tente novamente.');
    botao.disabled = false;
  }
});
