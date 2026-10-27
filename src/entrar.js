import './style.css';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { iniciarSessao } from './sessao.js';
import { criarPerfil } from './usuarios.js';

const form = document.querySelector('#form-conta');
const msg = document.querySelector('#msg');
const botaoEnviar = document.querySelector('#enviar');
const campoNome = document.querySelector('#campo-nome');
let modo = 'entrar';
let processando = false; // evita sair da página antes de salvar o perfil do usuário novo

const MENSAGENS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Use "Entrar".',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase (Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'Esse método de login não está ativado no Firebase.',
};

function mostrar(texto, tipo = 'erro') {
  msg.textContent = texto;
  msg.className = `mensagem ${tipo}`;
}

function erro(e) {
  console.error(e);
  mostrar(MENSAGENS[e.code] || 'Não foi possível concluir. Tente novamente.');
}

function trocarModo(novo) {
  modo = novo;
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === novo)));
  campoNome.hidden = novo !== 'criar';
  form.elements.senha.autocomplete = novo === 'criar' ? 'new-password' : 'current-password';
  botaoEnviar.textContent = novo === 'criar' ? 'Criar conta' : 'Entrar';
  document.querySelector('#esqueci').hidden = novo === 'criar';
  mostrar('', '');
}

document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => trocarModo(b.dataset.modo)));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = form.elements.email.value.trim();
  const senha = form.elements.senha.value;
  botaoEnviar.disabled = true;
  processando = true;
  try {
    if (modo === 'criar') {
      const nome = form.elements.nome.value.trim() || email.split('@')[0];
      const { user } = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(user, { displayName: nome });
      await sendEmailVerification(user).catch(() => {}); // confirma que o e-mail é seu (exigido para admins)
      await criarPerfil(user.uid, { nome, email });
    } else {
      await signInWithEmailAndPassword(auth, email, senha);
    }
    location.replace('/');
  } catch (e) {
    processando = false;
    erro(e);
  } finally {
    botaoEnviar.disabled = false;
  }
});

document.querySelector('#google').addEventListener('click', async () => {
  processando = true;
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    await criarPerfil(user.uid, { nome: user.displayName || '', email: user.email });
    location.replace('/');
  } catch (e) {
    processando = false;
    erro(e);
  }
});

document.querySelector('#esqueci').addEventListener('click', async () => {
  const email = form.elements.email.value.trim();
  if (!email) {
    mostrar('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    mostrar('Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.', 'ok');
  } catch (e) {
    erro(e);
  }
});

// Já logado (ou acabou de entrar): volta para a vitrine
iniciarSessao('entrar', ({ usuario }) => {
  if (usuario && !processando) location.replace('/');
});
