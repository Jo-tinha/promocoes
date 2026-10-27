// APIs públicas e gratuitas, sem chave:
// - CheapShark: promoções reais de jogos de PC em lojas como Steam, Epic, GOG e Humble (preços em dólar)
// - AwesomeAPI: cotação atual do dólar em reais

const CHEAPSHARK = 'https://www.cheapshark.com';

async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao consultar ${url} (HTTP ${resp.status})`);
  return resp.json();
}

export const linkDaPromocao = (dealID) => `${CHEAPSHARK}/redirect?dealID=${encodeURIComponent(dealID)}`;

function converter(p) {
  return {
    dealID: p.dealID,
    gameID: p.gameID,
    titulo: p.title,
    lojaId: p.storeID,
    precoNormal: Number(p.normalPrice),
    precoPromocional: Number(p.salePrice),
    desconto: Math.round(Number(p.savings)),
    imagem: p.thumb,
    avaliacao: p.steamRatingText || '',
    link: linkDaPromocao(p.dealID),
  };
}

// Promoções atuais na CheapShark.
// ordem: 'Recent' (chegaram por último), 'Savings' (maior desconto), 'Deal Rating' (melhor custo-benefício)
export async function buscarPromocoes({ termo = '', lojaId = '', ordem = 'Recent', limite = 60 } = {}) {
  const params = new URLSearchParams({ onSale: '1', pageSize: String(limite), sortBy: ordem });
  if (termo) params.set('title', termo);
  if (lojaId) params.set('storeID', lojaId);
  const lista = await getJson(`${CHEAPSHARK}/api/1.0/deals?${params}`);
  return lista.map(converter);
}

// Situação atual de uma promoção específica (usada para atualizar o preço de uma promoção aprovada)
export async function buscarPromocaoPorId(dealID) {
  const dados = await getJson(`${CHEAPSHARK}/api/1.0/deals?id=${encodeURIComponent(dealID)}`);
  const info = dados.gameInfo;
  const normal = Number(info.retailPrice);
  const promocional = Number(info.salePrice);
  return {
    precoNormal: normal,
    precoPromocional: promocional,
    desconto: normal > 0 ? Math.round((1 - promocional / normal) * 100) : 0,
    emPromocao: promocional < normal,
  };
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
  return { valor: Number(dados.USDBRL.bid), atualizadoEm: dados.USDBRL.create_date };
}
