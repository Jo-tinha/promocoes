import './style.css';
import { listarOfertas, ofertaVigente } from './ofertas.js';
import { firebaseConfigurado } from './firebase.js';
import { buscarPromocoes, buscarLojas, buscarCotacaoDolar } from './api.js';
import { formatarReal, percentualDesconto, esc, formatarData, IMAGEM_PADRAO } from './util.js';

const gradeOficiais = document.querySelector('#grade-oficiais');
const gradeCatalogo = document.querySelector('#grade-catalogo');
const elCotacao = document.querySelector('#cotacao');
const campoBusca = document.querySelector('#busca');
const campoLoja = document.querySelector('#loja');

let cotacao = null; // valor do dólar em reais
const lojas = new Map(); // id da loja → { nome, icone }

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

// ---------- Promoções das lojas (CheapShark + AwesomeAPI) ----------
function precoEmReal(dolar) {
  if (dolar === 0) return 'Grátis';
  return cotacao ? formatarReal(dolar * cotacao) : `US$ ${dolar.toFixed(2)}`;
}

function cartaoPromocao(p) {
  const loja = lojas.get(p.lojaId);
  return `
    <a class="cartao cartao-link" href="${esc(p.link)}" target="_blank" rel="noopener sponsored">
      <div class="cartao-imagem imagem-jogo">
        <img src="${esc(p.imagem)}" alt="${esc(p.titulo)}" loading="lazy" onerror="this.src='${IMAGEM_PADRAO}'" />
        ${p.desconto >= 1 ? `<span class="selo selo-desconto">-${p.desconto}%</span>` : ''}
      </div>
      <div class="cartao-corpo">
        <span class="categoria loja">
          ${loja ? `<img src="${esc(loja.icone)}" alt="" width="16" height="16" />${esc(loja.nome)}` : 'Loja parceira'}
        </span>
        <h3>${esc(p.titulo)}</h3>
        ${p.avaliacao ? `<p class="descricao">Steam: ${esc(p.avaliacao)}</p>` : ''}
        <div class="precos">
          ${p.desconto >= 1 ? `<span class="preco-antigo">${precoEmReal(p.precoNormal)}</span>` : ''}
          <span class="preco-final">${precoEmReal(p.precoPromocional)}</span>
        </div>
        <span class="validade">Ver na loja →</span>
      </div>
    </a>`;
}

let requisicaoAtual = 0;
async function carregarPromocoes() {
  const id = ++requisicaoAtual; // ignora respostas antigas se o usuário digitar rápido
  gradeCatalogo.classList.add('carregando');
  try {
    const promocoes = await buscarPromocoes({ termo: campoBusca.value.trim(), lojaId: campoLoja.value });
    if (id !== requisicaoAtual) return;
    gradeCatalogo.innerHTML = promocoes.length
      ? promocoes.map(cartaoPromocao).join('')
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

async function carregarCotacao() {
  try {
    const { valor, atualizadoEm } = await buscarCotacaoDolar();
    cotacao = valor;
    const hora = atualizadoEm ? ` · ${atualizadoEm.slice(11, 16)}` : '';
    elCotacao.innerHTML = `Dólar hoje: <strong>${formatarReal(valor)}</strong><span>${hora}</span>`;
  } catch (erro) {
    console.error(erro);
    elCotacao.textContent = 'Cotação indisponível: preços das promoções exibidos em dólar.';
  }
}

async function carregarLojas() {
  try {
    const lista = await buscarLojas();
    lista.forEach((l) => lojas.set(l.id, l));
    campoLoja.insertAdjacentHTML(
      'beforeend',
      lista.map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
    );
  } catch (erro) {
    console.error(erro); // sem a lista, os cartões aparecem como "Loja parceira"
  }
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

// Ofertas oficiais carregam em paralelo; as promoções esperam a cotação e as lojas para já mostrar R$ e o nome da loja
carregarOficiais();
Promise.all([carregarCotacao(), carregarLojas()]).then(carregarPromocoes);
