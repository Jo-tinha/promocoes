// Painel do administrador
import './style.css';
import { iniciarSessao } from './sessao.js';
import { iniciarAveriguar, carregarVitrineAdmin } from './admin-averiguar.js';
import { iniciarRecomendacoesAdmin, carregarRecomendacoesAdmin } from './admin-recomendacoes.js';
import { esc } from './util.js';
import { sendEmailVerification } from 'firebase/auth';
import { EMAILS_ADMIN } from './admins.js';

const emailNaLista = (u) => EMAILS_ADMIN.includes(String(u.email).toLowerCase());

const semAcesso = document.querySelector('#sem-acesso');
const semAcessoTexto = document.querySelector('#sem-acesso-texto');
const painel = document.querySelector('#painel');

const abas = {
  averiguar: { painel: document.querySelector('#aba-averiguar') },
  vitrine: { painel: document.querySelector('#aba-vitrine'), carregar: carregarVitrineAdmin },
  recomendacoes: { painel: document.querySelector('#aba-recomendacoes'), carregar: carregarRecomendacoesAdmin },
};

function abrirAba(nome) {
  document.querySelectorAll('.aba').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === nome)));
  Object.entries(abas).forEach(([chave, aba]) => (aba.painel.hidden = chave !== nome));
  abas[nome].carregar?.();
}
document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.aba)));

let iniciado = false;
iniciarSessao('admin', ({ usuario, admin }) => {
  painel.hidden = !admin;
  semAcesso.hidden = admin;

  if (!usuario) {
    semAcessoTexto.innerHTML = '<p>Entre com a conta de administrador.</p><a class="botao" href="/entrar.html">Entrar</a>';
    return;
  }
  if (!admin) {
    // Mostra o UID para facilitar a criação do documento admins/{uid} no console do Firebase
    semAcessoTexto.innerHTML = `
      <p>Sua conta (<strong>${esc(usuario.email)}</strong>) não tem acesso de administrador.</p>
      ${
        emailNaLista(usuario) && !usuario.emailVerified
          ? `<p>Este e-mail é de admin, mas ainda <strong>não foi verificado</strong>. Abra o link que enviamos para ele
               (ou entre com o Google usando o mesmo e-mail) e depois recarregue esta página.</p>
             <button class="botao secundario pequeno" type="button" id="reenviar-verificacao">Reenviar e-mail de verificação</button>`
          : `<p>Admins são definidos em <code>src/admins.js</code> e em <code>firestore.rules</code>. Também é possível liberar uma conta
               criando no Firestore a coleção <code>admins</code> com um documento cujo ID seja:</p>
             <p><code style="user-select:all;word-break:break-all">${esc(usuario.uid)}</code></p>`
      }`;
    document.querySelector('#reenviar-verificacao')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        await sendEmailVerification(usuario);
        e.target.textContent = 'E-mail enviado — confira a caixa de entrada e o spam';
      } catch {
        e.target.textContent = 'Aguarde um pouco antes de pedir de novo';
      }
    });
    return;
  }
  if (!iniciado) {
    iniciado = true;
    iniciarRecomendacoesAdmin();
    iniciarAveriguar();
    abrirAba('averiguar');
  }
});
