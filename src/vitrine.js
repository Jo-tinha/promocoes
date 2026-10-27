import './style.css';
import { listarOfertas, ofertaVigente } from './ofertas.js';
import { firebaseConfigurado } from './firebase.js';
import { buscarProdutos, buscarCategorias, buscarCotacaoDolar } from './api.js';
import { formatarReal, percentualDesconto, esc, formatarData, IMAGEM_PADRAO } from './util.js';

const gradeOficiais = document.querySelector('#grade-oficiais');
const gradeCatalogo = document.querySelector('#grade-catalogo');
const elCotacao = document.querySelector('#cotacao');
const campoBusca = document.querySelector('#busca');
const campoCategoria = document.querySelector('#categoria');

let cotacao = null; // valor do dólar em reais

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
    gradeOficiais.innerHTML = '<div class="aviso erro">Firebase não configurado. Preencha as variáveis de ambiente (veja o README).</div>';
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

// ---------- Catálogo (APIs públicas) ----------
function precoEmReal(dolar) {
  return cotacao ? formatarReal(dolar * cotacao) : `US$ ${dolar.toFixed(2)}`;
}

function cartaoProduto(p) {
  const desconto = p.discountPercentage || 0;
  const original = p.price / (1 - desconto / 100);
  return `
    <article class="cartao">
      <div class="cartao-imagem">
        <img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
        ${desconto >= 1 ? `<span class="selo selo-desconto">-${Math.round(desconto)}%</span>` : ''}
      </div>
      <div class="cartao-corpo">
        <span class="categoria">${esc(p.category)}${p.brand ? ` · ${esc(p.brand)}` : ''}</span>
        <h3>${esc(p.title)}</h3>
        <p class="descricao">${esc(p.description)}</p>
        <div class="precos">
          ${desconto >= 1 ? `<span class="preco-antigo">${precoEmReal(original)}</span>` : ''}
          <span class="preco-final">${precoEmReal(p.price)}</span>
        </div>
      </div>
    </article>`;
}

let requisicaoAtual = 0;
async function carregarCatalogo() {
  const id = ++requisicaoAtual; // ignora respostas antigas se o usuário digitar rápido
  gradeCatalogo.classList.add('carregando');
  try {
    const termo = campoBusca.value.trim();
    const categoria = campoCategoria.value;
    let produtos = await buscarProdutos({ termo, categoria });
    if (termo && categoria) produtos = produtos.filter((p) => p.category === categoria);
    if (id !== requisicaoAtual) return;
    gradeCatalogo.innerHTML = produtos.length
      ? produtos.map(cartaoProduto).join('')
      : '<div class="aviso">Nenhum produto encontrado para essa busca.</div>';
  } catch (erro) {
    console.error(erro);
    if (id === requisicaoAtual) {
      gradeCatalogo.innerHTML = '<div class="aviso erro">Não foi possível carregar o catálogo agora. Tente recarregar a página.</div>';
    }
  } finally {
    if (id === requisicaoAtual) gradeCatalogo.classList.remove('carregando');
  }
}

async function carregarCotacao() {
  try {
    const { valor, atualizadoEm } = await buscarCotacaoDolar();
    cotacao = valor;
    const hora = atualizadoEm ? ` · ${atualizadoEm.slice(11, 16)}` : '';
    elCotacao.innerHTML = `Dólar hoje: <strong>${formatarReal(valor)}</strong><span>${hora}</span>`;
  } catch (erro) {
    console.error(erro);
    elCotacao.textContent = 'Cotação indisponível: preços do catálogo exibidos em dólar.';
  }
}

async function carregarCategorias() {
  try {
    const categorias = await buscarCategorias();
    campoCategoria.insertAdjacentHTML(
      'beforeend',
      categorias.map((c) => `<option value="${esc(c)}">${esc(c.replaceAll('-', ' '))}</option>`).join(''),
    );
  } catch (erro) {
    console.error(erro);
  }
}

// Busca com pequena espera para não chamar a API a cada tecla
let espera;
campoBusca.addEventListener('input', () => {
  clearTimeout(espera);
  espera = setTimeout(carregarCatalogo, 350);
});
campoCategoria.addEventListener('change', carregarCatalogo);
document.querySelector('#filtros').addEventListener('submit', (e) => {
  e.preventDefault();
  carregarCatalogo();
});

// As duas fontes carregam em paralelo; o catálogo espera a cotação para mostrar preços em reais
carregarOficiais();
carregarCategorias();
carregarCotacao().then(carregarCatalogo);
