// Cabeçalho compartilhado + estado de login (visitante, usuário ou admin)
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { ehAdmin, buscarAvisos } from './usuarios.js';
import { carregarContexto, dolarParaReal } from './contexto.js';
import { esc } from './util.js';

const topo = document.querySelector('#topo');

function link(href, texto, ativo, extra = '') {
  return `<a href="${href}" class="nav-link${ativo ? ' ativo' : ''}"${ativo ? ' aria-current="page"' : ''}>${texto}${extra}</a>`;
}

function renderizarTopo(usuario, admin, pagina) {
  const nav = usuario
    ? [
        link('/', 'Vitrine', pagina === 'vitrine'),
        link('/notificar.html', 'Notificar', pagina === 'notificar', ' <span class="contador" id="sino" hidden></span>'),
        admin ? link('/admin.html', 'Painel', pagina === 'admin') : '',
      ].join('')
    : link('/', 'Vitrine', pagina === 'vitrine');

  const conta = usuario
    ? `<span class="usuario-email" title="${esc(usuario.email)}">${esc(usuario.displayName || usuario.email)}</span>
       <button class="botao secundario pequeno" id="sair" type="button">Sair</button>`
    : pagina === 'entrar'
      ? ''
      : '<a class="botao pequeno" href="/entrar.html">Entrar</a>';

  topo.innerHTML = `
    <div class="container topo-linha">
      <a class="marca" href="/">Buba <span>Promo</span></a>
      <nav class="nav" aria-label="Principal">${nav}</nav>
      <div class="conta">${conta}</div>
    </div>`;

  document.querySelector('#sair')?.addEventListener('click', async () => {
    await signOut(auth);
    location.href = '/';
  });
}

// Mostra no menu "Notificar" quantos avisos novos o usuário tem
export async function atualizarSino(uid) {
  try {
    await carregarContexto();
    const { novos } = await buscarAvisos(uid, dolarParaReal);
    const sino = document.querySelector('#sino');
    if (!sino) return;
    sino.hidden = novos === 0;
    sino.textContent = novos;
    sino.title = `${novos} ${novos === 1 ? 'aviso novo' : 'avisos novos'}`;
  } catch (erro) {
    console.error(erro);
  }
}

// pagina: 'vitrine' | 'notificar' | 'admin' | 'entrar'
// aoMudar({ usuario, admin }) é chamado sempre que o login muda
export function iniciarSessao(pagina, aoMudar) {
  renderizarTopo(null, false, pagina);
  onAuthStateChanged(auth, async (usuario) => {
    const admin = usuario ? await ehAdmin(usuario.uid) : false;
    renderizarTopo(usuario, admin, pagina);
    aoMudar?.({ usuario, admin });
    if (usuario) atualizarSino(usuario.uid);
  });
}
