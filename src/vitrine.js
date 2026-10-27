import './style.css';
import { listarOfertas, ofertaVigente } from './ofertas.js';
import { listarRecomendacoes } from './recomendacoes.js';
import { firebaseConfigurado } from './firebase.js';
import { buscarPromocoes } from './api.js';
import { contexto, carregarContexto, precoEmReal, nomeDaLoja, iconeDaLoja } from './contexto.js';
import { formatarReal, percentualDesconto, esc, formatarData, IMAGEM_PADRAO } from './util.js';

const gradeOficiais = document.querySelector('#grade-oficiais');
const gradeRecomendacoes = document.querySelector('#grade-recomendacoes');
const gradeCatalogo = document.querySelector('#grade-catalogo');
const elCotacao = document.querySelector('#cotacao');
const campoBusca = document.querySelector('#busca');
const campoLoja = document.querySelector('#loja');

const AVISO_FIREBASE = '<div class="aviso erro">Firebase não configurado. Preencha as variáveis de ambiente (veja o README).</div>';

// ---------- Ofertas oficiais (Firestore) ----------
function cartaoOficial(o) {
  const desconto = percentualDesconto(o.precoOriginal, o.precoOferta);
  return `
    <article class="cartao">
      <div class="cartao-imagem">
        <img src="${esc(o.imagemUrl) || IMAGEM_PADRAO}" alt="${esc(o.titulo)}" loading="lazy"
             onerror="this.src='${IMAGEM_PADRAO}'" />
        <span class="selo oficial">Oficial</span>
        <span class="selo selo-desconto">-${desconto}%</span>
      </div>
      <div class="cartao-corpo">
        <span class="categoria">${esc(o.categoria)}</span>
        <h3>${esc(o.titulo)}</h3>
        <p class="descricao">${esc(o.descricao)}</p>
        <div class="precos">
          <span class="preco-antigo">${formatarReal(o.precoOriginal)}</span>
          <span class="preco-final">${formatarReal(o.precoOferta)}</span>
        </div>
        <span class="validade">Válida até ${formatarData(o.validoAte?.toDate())}</span>
      </div>
    </article>`;
}

async function carregarOficiais() {
  if (!firebaseConfigurado) {
    gradeOficiais.innerHTML = AVISO_FIREBASE;
    return;
  }
  try {
    const ofertas = (await listarOfertas()).filter(ofertaVigente);
    gradeOficiais.innerHTML = ofertas.length
      ? ofertas.map(cartaoOficial).join('')
      : '<div class="aviso">Nenhuma oferta oficial no momento. Volte em breve!</div>';
  } catch (erro) {
    console.error(erro);
    gradeOficiais.innerHTML = '<div class="aviso erro">Não foi possível carregar as ofertas oficiais.</div>';
  }
}

// ---------- Cartão de promoção (usado nas recomendações e nas promoções da API) ----------
function cartaoPromocao(p, comentario = null) {
  const icone = iconeDaLoja(p.lojaId);
  return `
    <a class="cartao cartao-link" href="${esc(p.link)}" target="_blank" rel="noopener sponsored">
      <div class="cartao-imagem imagem-jogo">
        <img src="${esc(p.imagem)}" alt="${esc(p.titulo)}" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
        ${comentario !== null ? '<span class="selo">Recomendado</span>' : ''}
        ${p.desconto >= 1 ? `<span class="selo selo-desconto">-${p.desconto}%</span>` : ''}
      </div>
      <div class="cartao-corpo">
        <span class="categoria loja">
          ${icone ? `<img src="${esc(icone)}" alt="" width="16" height="16" />` : ''}${esc(nomeDaLoja(p.lojaId))}
        </span>
        <h3>${esc(p.titulo)}</h3>
        ${comentario ? `<p class="comentario-admin">“${esc(comentario)}”</p>` : ''}
        ${!comentario && p.avaliacao ? `<p class="descricao">Steam: ${esc(p.avaliacao)}</p>` : ''}
        <div class="precos">
          ${p.desconto >= 1 ? `<span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>` : ''}
          <span class="preco-final">${precoEmReal(p.precoPromocional)}</span>
        </div>
        <span class="validade">${comentario !== null ? 'Preço quando recomendado · ' : ''}Ver na loja →</span>
      </div>
    </a>`;
}

// ---------- Recomendações (Firestore, escolhidas pelo admin) ----------
async function carregarRecomendacoes() {
  if (!firebaseConfigurado) {
    gradeRecomendacoes.innerHTML = AVISO_FIREBASE;
    return;
  }
  try {
    const lista = await listarRecomendacoes();
    gradeRecomendacoes.innerHTML = lista.length
      ? lista.map((r) => cartaoPromocao({ ...r, id: r.dealID }, r.comentario || '')).join('')
      : '<div class="aviso">Ainda não há recomendações. Volte em breve!</div>';
  } catch (erro) {
    console.error(erro);
    gradeRecomendacoes.innerHTML = '<div class="aviso erro">Não foi possível carregar as recomendações.</div>';
  }
}

// ---------- Promoções nas lojas (CheapShark) ----------
let requisicaoAtual = 0;
async function carregarPromocoes() {
  const id = ++requisicaoAtual; // ignora respostas antigas se o usuário digitar rápido
  gradeCatalogo.classList.add('carregando');
  try {
    const promocoes = await buscarPromocoes({ termo: campoBusca.value.trim(), lojaId: campoLoja.value });
    if (id !== requisicaoAtual) return;
    gradeCatalogo.innerHTML = promocoes.length
      ? promocoes.map((p) => cartaoPromocao(p)).join('')
      : '<div class="aviso">Nenhuma promoção encontrada para essa busca.</div>';
  } catch (erro) {
    console.error(erro);
    if (id === requisicaoAtual) {
      gradeCatalogo.innerHTML = '<div class="aviso erro">Não foi possível carregar as promoções agora. Tente recarregar a página.</div>';
    }
  } finally {
    if (id === requisicaoAtual) gradeCatalogo.classList.remove('carregando');
  }
}

function mostrarContexto() {
  if (contexto.cotacao) {
    const hora = contexto.atualizadoEm ? ` · ${contexto.atualizadoEm.slice(11, 16)}` : '';
    elCotacao.innerHTML = `Dólar hoje: <strong>${formatarReal(contexto.cotacao)}</strong><span>${hora}</span>`;
  } else {
    elCotacao.textContent = 'Cotação indisponível: preços das promoções exibidos em dólar.';
  }
  campoLoja.insertAdjacentHTML(
    'beforeend',
    [...contexto.lojas.values()].map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
  );
}

// Busca com pequena espera para não chamar a API a cada tecla
let espera;
campoBusca.addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(carregarPromocoes, 400);
});
campoLoja.addEventListener('change', carregarPromocoes);
document.querySelector('#filtros').addEventListener('submit', (e) => {
  e.preventDefault();
  carregarPromocoes();
});

// Ofertas oficiais carregam em paralelo; recomendações e promoções esperam a cotação e as lojas
carregarOficiais();
carregarContexto().then(() => {
  mostrarContexto();
  carregarRecomendacoes();
  carregarPromocoes();
});
