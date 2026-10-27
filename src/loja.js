// Página de uma loja: todas as promoções dela numa grade de tela cheia
import './style.css';
import { iniciarSessao } from './sessao.js';
import { buscarPromocoes } from './api.js';
import { contexto, carregarContexto, nomeDaLoja } from './contexto.js';
import { varsDaLoja } from './lojas.js';
import { cartaoJogo, esqueletos, redesenharEstrelas } from './cartoes.js';
import { definirUsuario, carregarEstrelas, ativarEstrelas } from './estrela.js';
import { salvarNoCatalogo } from './catalogo.js';

const $ = (s) => document.querySelector(s);
const grade = $('#grade-loja');
const botaoMais = $('#carregar-mais');
const POR_PAGINA = 60;

const lojaId = new URLSearchParams(location.search).get('id') || '1';
const estado = { pagina: 0, termo: '', ordem: 'Deal Rating', promos: new Map(), total: 0, carregando: false };

async function carregarPagina({ reiniciar = false } = {}) {
  if (estado.carregando) return;
  estado.carregando = true;
  if (reiniciar) {
    estado.pagina = 0;
    estado.total = 0;
    grade.innerHTML = esqueletos(8);
  }
  botaoMais.hidden = true;
  try {
    const lista = await buscarPromocoes({ lojaId, termo: estado.termo, ordem: estado.ordem, limite: POR_PAGINA, pagina: estado.pagina });
    lista.forEach((p) => estado.promos.set(p.dealID, p));
    salvarNoCatalogo(lista);
    const html = lista.map((p, i) => cartaoJogo(p, { i })).join('');
    if (reiniciar) grade.innerHTML = html || '<div class="aviso">Nenhuma promoção encontrada nesta loja.</div>';
    else grade.insertAdjacentHTML('beforeend', html);
    estado.total += lista.length;
    estado.pagina += 1;
    botaoMais.hidden = lista.length < POR_PAGINA;
    $('#nota-loja').textContent = `${estado.total}${botaoMais.hidden ? '' : '+'} promoções${estado.termo ? ` para “${estado.termo}”` : ''}`;
  } catch (erro) {
    console.error(erro);
    if (reiniciar) grade.innerHTML = '<div class="aviso erro">Não foi possível carregar as promoções agora.</div>';
    botaoMais.hidden = false;
  } finally {
    estado.carregando = false;
  }
}

let espera;
$('#busca-loja').addEventListener('input', (e) => {
  clearTimeout(espera);
  espera = setTimeout(() => {
    estado.termo = e.target.value.trim();
    carregarPagina({ reiniciar: true });
  }, 450);
});
$('#ordem-loja').addEventListener('change', (e) => {
  estado.ordem = e.target.value;
  carregarPagina({ reiniciar: true });
});
botaoMais.addEventListener('click', () => carregarPagina());

// rolagem infinita: carrega a próxima página ao chegar perto do fim
new IntersectionObserver((entradas) => {
  if (entradas[0].isIntersecting && !botaoMais.hidden) carregarPagina();
}, { rootMargin: '600px' }).observe(botaoMais);

ativarEstrelas();

async function iniciar() {
  await carregarContexto();
  const loja = contexto.lojas.get(lojaId);
  const nome = nomeDaLoja(lojaId);
  document.title = `${nome} · Buba Promo`;
  $('#nome-loja').textContent = nome;
  $('#cabeca-loja').setAttribute('style', varsDaLoja(lojaId));
  document.body.setAttribute('style', varsDaLoja(lojaId));
  if (loja) {
    const logo = $('#logo-loja');
    logo.src = loja.logo;
    logo.onerror = () => (logo.src = loja.icone);
    logo.hidden = false;
  }
  $("#busca-loja").placeholder = `Buscar na ${nome}`;
  carregarPagina({ reiniciar: true });
}
iniciar();

iniciarSessao('loja', async ({ usuario }) => {
  definirUsuario(usuario);
  await carregarEstrelas();
  redesenharEstrelas((dealID) => estado.promos.get(dealID));
  if (usuario) salvarNoCatalogo([...estado.promos.values()]);
});
