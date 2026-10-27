// Página "Games": catálogo de todos os jogos que já passaram em promoção, com estrela para receber avisos
import './style.css';
import { iniciarSessao } from './sessao.js';
import { listarCatalogo } from './catalogo.js';
import { carregarContexto, precoEmReal } from './contexto.js';
import { varsDaLoja, imagemGrande } from './lojas.js';
import { pilulaLoja } from './cartoes.js';
import { definirUsuario, carregarEstrelas, ativarEstrelas, botaoEstrela, estaEstrelado } from './estrela.js';
import { pedirPermissao, permissaoAtual, suportaNotificacoes } from './notificacoes.js';
import { esc, IMAGEM_PADRAO } from './util.js';

const $ = (s) => document.querySelector(s);
const grade = $('#grade-jogos');
const botaoMais = $('#mostrar-mais');
const POR_VEZ = 60;

let jogos = [];
let mostrando = POR_VEZ;
let usuario = null;

function cartao(j, i) {
  const visto = j.ultimaPromocaoEm ? j.ultimaPromocaoEm.toDate().toLocaleDateString('pt-BR') : '';
  const busca = `/?q=${encodeURIComponent(j.titulo)}`;
  return `
    <article class="jogo" data-deal="${esc(j.gameID)}" style="${varsDaLoja(j.lojaId)};--i:${Math.min(i, 20)}">
      <a class="jogo-capa" href="${busca}" tabindex="-1">
        <img src="${esc(imagemGrande(j.imagem))}" alt="" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
        ${j.lojaId ? pilulaLoja(j.lojaId) : ''}
        ${j.ultimoDesconto >= 1 ? `<span class="desconto">-${j.ultimoDesconto}%</span>` : ''}
      </a>
      <div class="jogo-corpo">
        <h3 title="${esc(j.titulo)}">${esc(j.titulo)}</h3>
        <div class="metas">${visto ? `<span class="meta">visto em promoção em ${visto}</span>` : ''}</div>
        ${
          j.ultimoPreco !== undefined
            ? `<div class="precos">
                 ${j.ultimoPrecoNormal ? `<span class="preco-antigo">${precoEmReal(j.ultimoPrecoNormal)}</span>` : ''}
                 <span class="preco-final">${j.ultimoPreco === 0 ? 'Grátis' : precoEmReal(j.ultimoPreco)}</span>
               </div>`
            : ''
        }
        <div class="jogo-rodape">
          <a href="${busca}">Ver ofertas atuais →</a>
          ${botaoEstrela(j)}
        </div>
      </div>
    </article>`;
}

const ORDENS = {
  recentes: (a, b) => (b.ultimaPromocaoEm?.toMillis() ?? 0) - (a.ultimaPromocaoEm?.toMillis() ?? 0),
  az: (a, b) => a.titulo.localeCompare(b.titulo),
  desconto: (a, b) => (b.ultimoDesconto || 0) - (a.ultimoDesconto || 0),
};

function renderizar() {
  const termo = $('#busca-jogos').value.trim().toLowerCase();
  const soEstrelados = $('#filtro-jogos').value === 'estrelados';
  const lista = jogos
    .filter((j) => !termo || j.titulo.toLowerCase().includes(termo))
    .filter((j) => !soEstrelados || estaEstrelado(j.gameID))
    .sort(ORDENS[$('#ordem-jogos').value]);
  const estrelados = jogos.filter((j) => estaEstrelado(j.gameID)).length;
  $('#nota-jogos').textContent = `${jogos.length} jogos no catálogo${usuario ? ` · ${estrelados} estrelados` : ''}${termo || soEstrelados ? ` · ${lista.length} mostrados` : ''}`;
  grade.innerHTML = lista.length
    ? lista.slice(0, mostrando).map(cartao).join('')
    : `<div class="aviso">${
        jogos.length
          ? soEstrelados
            ? 'Você ainda não estrelou nenhum jogo.'
            : 'Nenhum jogo encontrado com esse nome.'
          : 'O catálogo ainda está vazio. Ele cresce conforme as promoções aparecem no Buba Promo.'
      }</div>`;
  botaoMais.hidden = lista.length <= mostrando;
}

function renderizarAvisoNotificacao() {
  const aviso = $('#aviso-notificacao');
  const permissao = permissaoAtual();
  if (!usuario || !suportaNotificacoes() || permissao === 'granted') {
    aviso.hidden = true;
    return;
  }
  aviso.hidden = false;
  aviso.innerHTML =
    permissao === 'denied'
      ? '🔕 As notificações estão bloqueadas para este site. Libere nas configurações do navegador (ícone ao lado do endereço) para receber os avisos.'
      : '🔔 Ative as notificações para saber na hora quando um jogo estrelado entrar em promoção. <button class="botao pequeno" type="button" id="ativar-notificacoes">Ativar notificações</button>';
  $('#ativar-notificacoes')?.addEventListener('click', async () => {
    await pedirPermissao();
    renderizarAvisoNotificacao();
  });
}

let espera;
$('#busca-jogos').addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    mostrando = POR_VEZ;
    renderizar();
  }, 200);
});
$('#ordem-jogos').addEventListener('change', renderizar);
$('#filtro-jogos').addEventListener('change', renderizar);
botaoMais.addEventListener('click', () => {
  mostrando += POR_VEZ;
  renderizar();
});
// depois de estrelar com o filtro "Só os estrelados", a lista se atualiza; e o aviso de permissão muda
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-estrela]')) setTimeout(() => (renderizarAvisoNotificacao(), $('#filtro-jogos').value === 'estrelados' && renderizar()), 800);
});

ativarEstrelas();

async function iniciar() {
  grade.innerHTML = '<div class="aviso">Carregando o catálogo…</div>';
  try {
    await carregarContexto();
    jogos = await listarCatalogo();
    renderizar();
  } catch (erro) {
    console.error(erro);
    grade.innerHTML = '<div class="aviso erro">Não foi possível carregar o catálogo. Confira as regras do Firestore.</div>';
  }
}
iniciar();

iniciarSessao('games', async ({ usuario: u }) => {
  usuario = u;
  definirUsuario(u);
  await carregarEstrelas();
  renderizarAvisoNotificacao();
  if (jogos.length) renderizar();
});
