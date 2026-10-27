// APIs públicas e gratuitas, sem chave:
// - CheapShark: promoções reais de jogos de PC em lojas como Steam, Epic, GOG e Humble (preços em dólar)
// - AwesomeAPI: cotação atual do dólar em reais

const CHEAPSHARK = 'https://www.cheapshark.com';

async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao consultar ${url} (HTTP ${resp.status})`);
  return resp.json();
}

// Promoções atuais. Sem filtros, traz as de maior desconto.
export async function buscarPromocoes({ termo = '', lojaId = '', limite = 36 } = {}) {
  const params = new URLSearchParams({
    onSale: '1',
    pageSize: String(limite),
    sortBy: termo ? 'Deal Rating' : 'Savings',
  });
  if (termo) params.set('title', termo);
  if (lojaId) params.set('storeID', lojaId);
  const promocoes = await getJson(`${CHEAPSHARK}/api/1.0/deals?${params}`);
  return promocoes.map((p) => ({
    id: p.dealID,
    titulo: p.title,
    lojaId: p.storeID,
    precoNormal: Number(p.normalPrice),
    precoPromocional: Number(p.salePrice),
    desconto: Math.round(Number(p.savings)),
    imagem: p.thumb,
    avaliacao: p.steamRatingText || '',
    link: `${CHEAPSHARK}/redirect?dealID=${encodeURIComponent(p.dealID)}`,
  }));
}

// Lojas acompanhadas pela CheapShark (só as ativas)
export async function buscarLojas() {
  const lojas = await getJson(`${CHEAPSHARK}/api/1.0/stores`);
  return lojas
    .filter((l) => l.isActive)
    .map((l) => ({ id: l.storeID, nome: l.storeName, icone: `${CHEAPSHARK}${l.images.icon}` }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarCotacaoDolar() {
  const dados = await getJson('https://economia.awesomeapi.com.br/json/last/USD-BRL');
  return {
    valor: Number(dados.USDBRL.bid),
    atualizadoEm: dados.USDBRL.create_date,
  };
}
