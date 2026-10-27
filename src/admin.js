import './style.css';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, firebaseConfigurado } from './firebase.js';
import { iniciarNotificar, carregarNotificar } from './admin-notificar.js';
import { iniciarRecomendacoes, carregarRecomendacoes } from './admin-recomendacoes.js';
import { iniciarOfertas, carregarOfertas } from './admin-ofertas.js';
import { carregarContexto } from './contexto.js';

const telaLogin = document.querySelector('#tela-login');
const telaPainel = document.querySelector('#tela-painel');
const formLogin = document.querySelector('#form-login');
const erroLogin = document.querySelector('#erro-login');
const blocoUsuario = document.querySelector('#usuario');

// ---------- Abas ----------
const abas = {
  notificar: { painel: document.querySelector('#aba-notificar'), carregar: carregarNotificar },
  recomendacoes: { painel: document.querySelector('#aba-recomendacoes'), carregar: carregarRecomendacoes },
  ofertas: { painel: document.querySelector('#aba-ofertas'), carregar: carregarOfertas },
};

function abrirAba(nome) {
  document.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === nome)));
  Object.entries(abas).forEach(([chave, aba]) => (aba.painel.hidden = chave !== nome));
  if (nome !== 'notificar') abas[nome].carregar(); // a inspeção só roda ao entrar no painel ou ao clicar em "Verificar de novo"
}

document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.aba)));

iniciarNotificar();
iniciarRecomendacoes();
iniciarOfertas();

// ---------- Autenticação ----------
if (!firebaseConfigurado) {
  telaLogin.hidden = false;
  erroLogin.textContent = 'Firebase não configurado. Preencha as variáveis de ambiente (veja o README).';
}

let painelCarregado = false;
onAuthStateChanged(auth, (usuario) => {
  const logado = Boolean(usuario);
  telaLogin.hidden = logado;
  telaPainel.hidden = !logado;
  blocoUsuario.hidden = !logado;
  document.querySelector('#voltar').hidden = logado;
  if (logado) {
    document.querySelector('#usuario-email').textContent = usuario.email;
    if (!painelCarregado) {
      painelCarregado = true;
      carregarContexto();
      abrirAba('notificar');
      carregarNotificar(); // inspeção diária roda ao abrir o painel
    }
  } else {
    painelCarregado = false;
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
