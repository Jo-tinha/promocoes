// APIs públicas e gratuitas, sem chave:
// - DummyJSON: catálogo de produtos (preços em dólar)
// - AwesomeAPI: cotação atual do dólar em reais

const DUMMY = 'https://dummyjson.com';
const CAMPOS = 'title,description,category,price,discountPercentage,thumbnail,rating,brand';

async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao consultar ${url} (HTTP ${resp.status})`);
  return resp.json();
}

export async function buscarProdutos({ termo = '', categoria = '', limite = 30 } = {}) {
  let url;
  if (termo) url = `${DUMMY}/products/search?q=${encodeURIComponent(termo)}&limit=${limite}&select=${CAMPOS}`;
  else if (categoria) url = `${DUMMY}/products/category/${encodeURIComponent(categoria)}?limit=${limite}&select=${CAMPOS}`;
  else url = `${DUMMY}/products?limit=${limite}&select=${CAMPOS}&sortBy=discountPercentage&order=desc`;
  const dados = await getJson(url);
  return dados.products;
}

export async function buscarCategorias() {
  const lista = await getJson(`${DUMMY}/products/category-list`);
  return lista;
}

export async function buscarCotacaoDolar() {
  const dados = await getJson('https://economia.awesomeapi.com.br/json/last/USD-BRL');
  return {
    valor: Number(dados.USDBRL.bid),
    atualizadoEm: dados.USDBRL.create_date,
  };
}
