// APIs públicas e gratuitas, sem chave:
// - CheapShark: promoções de jogos de PC em lojas como Steam, Epic, GOG e Humble (preços em dólar)
// - GamerPower: jogos de PC dados de graça (brindes por tempo limitado)
// - AwesomeAPI: cotação atual do dólar em reais

const CHEAPSHARK = 'https://www.cheapshark.com';

async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao consultar ${url} (HTTP ${resp.status})`);
  if (resp.status === 201) return []; // GamerPower: nenhum brinde ativo
  return resp.json();
}

// IDs da CheapShark podem vir já codificados (%3D); decodifica antes para não codificar duas vezes
const idLimpo = (id) => {
  try {
    return decodeURIComponent(String(id));
  } catch {
    return String(id);
  }
};

export const linkDaPromocao = (dealID) => `${CHEAPSHARK}/redirect?dealID=${encodeURIComponent(idLimpo(dealID))}`;

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
    steamAppID: p.steamAppID || null,
    avaliacao: p.steamRatingText || '',
    avaliacaoPct: Number(p.steamRatingPercent) || 0,
    avaliacoes: Number(p.steamRatingCount) || 0,
    metacritic: Number(p.metacriticScore) || 0,
    lancamento: Number(p.releaseDate) ? new Date(Number(p.releaseDate) * 1000) : null,
    link: linkDaPromocao(p.dealID),
  };
}

// Promoções atuais na CheapShark.
// ordem: 'Deal Rating' (melhor custo-benefício), 'Recent', 'Savings', 'Price', 'Reviews'
export async function buscarPromocoes({ termo = '', lojaId = '', ordem = 'Deal Rating', limite = 30, precoMaximo = null, pagina = 0 } = {}) {
  const params = new URLSearchParams({ onSale: '1', pageSize: String(limite), sortBy: ordem, pageNumber: String(pagina) });
  if (termo) params.set('title', termo);
  if (lojaId) params.set('storeID', lojaId);
  if (precoMaximo !== null) params.set('upperPrice', String(precoMaximo));
  const lista = await getJson(`${CHEAPSHARK}/api/1.0/deals?${params}`);
  return lista.map(converter);
}

// Situação atual de uma promoção específica (usada para atualizar o preço de um destaque)
export async function buscarPromocaoPorId(dealID) {
  const dados = await getJson(`${CHEAPSHARK}/api/1.0/deals?id=${encodeURIComponent(idLimpo(dealID))}`);
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

// Promoções atuais de vários jogos (até 25 por consulta) — usada nos avisos do Notificar
export async function buscarOfertasDosJogos(gameIDs) {
  const resultado = [];
  for (let i = 0; i < gameIDs.length; i += 25) {
    const lote = gameIDs.slice(i, i + 25);
    const dados = await getJson(`${CHEAPSHARK}/api/1.0/games?ids=${lote.map(encodeURIComponent).join(',')}`);
    for (const [gameID, jogo] of Object.entries(dados)) {
      for (const d of jogo.deals || []) {
        const normal = Number(d.retailPrice);
        const preco = Number(d.price);
        if (!(preco < normal)) continue; // só o que está em promoção
        resultado.push({
          dealID: decodeURIComponent(d.dealID),
          gameID,
          titulo: jogo.info.title,
          imagem: jogo.info.thumb,
          steamAppID: jogo.info.steamAppID || null,
          lojaId: d.storeID,
          precoNormal: normal,
          precoPromocional: preco,
          desconto: Math.round(Number(d.savings)),
          link: linkDaPromocao(decodeURIComponent(d.dealID)),
        });
      }
    }
  }
  return resultado;
}

// Todas as ofertas atuais de UM jogo, em todas as lojas, + o menor preço já registrado
export async function buscarOfertasDoJogo(gameID) {
  const dados = await getJson(`${CHEAPSHARK}/api/1.0/games?id=${encodeURIComponent(gameID)}`);
  const ofertas = (dados.deals || []).map((d) => {
    const dealID = decodeURIComponent(d.dealID);
    const normal = Number(d.retailPrice);
    const preco = Number(d.price);
    return {
      dealID,
      gameID,
      lojaId: d.storeID,
      precoNormal: normal,
      precoPromocional: preco,
      desconto: Math.round(Number(d.savings)) || 0,
      link: linkDaPromocao(dealID),
    };
  });
  return {
    titulo: dados.info?.title || '',
    imagem: dados.info?.thumb || '',
    steamAppID: dados.info?.steamAppID || null,
    menorPrecoHistorico: dados.cheapestPriceEver
      ? { preco: Number(dados.cheapestPriceEver.price), data: new Date(Number(dados.cheapestPriceEver.date) * 1000) }
      : null,
    ofertas: ofertas.sort((a, b) => a.precoPromocional - b.precoPromocional),
  };
}

// Jogos grátis: promoções de 100% na CheapShark + brindes da GamerPower
export async function buscarGratis() {
  const [cheapshark, gamerpower] = await Promise.allSettled([
    buscarPromocoes({ precoMaximo: 0, limite: 20, ordem: 'Recent' }),
    buscarBrindesGamerPower(),
  ]);
  const lista = [];
  if (cheapshark.status === 'fulfilled') {
    cheapshark.value
      .filter((p) => p.precoPromocional === 0)
      .forEach((p) => lista.push({ ...p, origem: 'cheapshark' }));
  }
  if (gamerpower.status === 'fulfilled') {
    const titulos = new Set(lista.map((p) => p.titulo.toLowerCase()));
    gamerpower.value
      .filter((g) => !titulos.has(g.titulo.toLowerCase()))
      .forEach((g) => lista.push(g));
  }
  if (cheapshark.status === 'rejected' && gamerpower.status === 'rejected') throw cheapshark.reason;
  return lista;
}

// A GamerPower às vezes bloqueia chamadas do navegador (CORS); por isso tenta primeiro
// a função do Vercel (/api/gratis) e, se não existir (ex.: npm run dev), chama direto.
async function buscarBrindesGamerPower() {
  let dados;
  try {
    dados = await getJson('/api/gratis');
  } catch {
    dados = await getJson('https://www.gamerpower.com/api/giveaways?platform=pc&type=game&sort-by=date');
  }
  if (!Array.isArray(dados)) return [];
  return dados
    .filter((g) => g.status === 'Active')
    .map((g) => ({
      dealID: `gp-${g.id}`,
      gameID: null,
      titulo: g.title.replace(/\s*\((Steam|Epic Games|GOG|PC)[^)]*\)\s*Giveaway$/i, '').replace(/\s*Giveaway$/i, ''),
      plataformas: g.platforms || '',
      precoNormal: Number(String(g.worth).replace(/[^\d.]/g, '')) || 0,
      precoPromocional: 0,
      desconto: 100,
      imagem: g.image || g.thumbnail, // "image" é a versão maior
      termina: g.end_date && g.end_date !== 'N/A' ? new Date(g.end_date.replace(' ', 'T')) : null,
      link: g.open_giveaway_url || g.gamerpower_url,
      origem: 'gamerpower',
    }));
}

// Jogos por nome (com ou sem promoção agora) — usado nas sugestões da busca.
// Retorna o menor preço atual entre as lojas. "sinal" permite cancelar buscas antigas.
export async function buscarJogosPorNome(titulo, { limite = 8, sinal } = {}) {
  const resp = await fetch(`${CHEAPSHARK}/api/1.0/games?title=${encodeURIComponent(titulo)}&limit=${limite}`, { signal: sinal });
  if (!resp.ok) throw new Error(`Falha na busca (HTTP ${resp.status})`);
  const lista = await resp.json();
  return lista.map((j) => ({
    gameID: j.gameID,
    steamAppID: j.steamAppID || null,
    titulo: j.external,
    imagem: j.thumb,
    menorPreco: Number(j.cheapest),
    dealID: j.cheapestDealID ? decodeURIComponent(j.cheapestDealID) : null,
    link: j.cheapestDealID ? linkDaPromocao(decodeURIComponent(j.cheapestDealID)) : null,
  }));
}

// Lojas acompanhadas pela CheapShark (só as ativas)
export async function buscarLojas() {
  const lojas = await getJson(`${CHEAPSHARK}/api/1.0/stores`);
  return lojas
    .filter((l) => l.isActive)
    .map((l) => ({
      id: l.storeID,
      nome: l.storeName,
      icone: `${CHEAPSHARK}${l.images.icon}`,
      logo: `${CHEAPSHARK}${l.images.logo}`,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarCotacaoDolar() {
  const dados = await getJson('https://economia.awesomeapi.com.br/json/last/USD-BRL');
  return { valor: Number(dados.USDBRL.bid), atualizadoEm: dados.USDBRL.create_date };
}
