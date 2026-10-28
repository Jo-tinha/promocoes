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

const LOJA_STEAM = '1';

// Link de uma promoção:
// - Steam: direto para a página do jogo (a CheapShark informa o ID do jogo na Steam);
// - demais lojas: o link da CheapShark, que leva direto à página da oferta na loja
//   (a API não informa o endereço da página do jogo nas outras lojas).
export function linkDaPromocao(dealID, { lojaId, steamAppID } = {}) {
  if (String(lojaId) === LOJA_STEAM && Number(steamAppID) > 0) {
    return `https://store.steampowered.com/app/${Number(steamAppID)}/`;
  }
  return `${CHEAPSHARK}/redirect?dealID=${encodeURIComponent(idLimpo(dealID))}`;
}

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
    link: linkDaPromocao(p.dealID, { lojaId: p.storeID, steamAppID: p.steamAppID }),
  };
}

// Promoções atuais na CheapShark.
// ordem: 'Deal Rating' (melhor custo-benefício), 'Recent', 'Savings', 'Price', 'Reviews'
// ordem também aceita 'Metacritic' (mais aclamados) e 'Release' (lançamentos);
// steamMin = nota mínima na Steam (%), metacriticMin = nota mínima no Metacritic, aaa = só jogos de preço cheio alto
export async function buscarPromocoes({
  termo = '',
  lojaId = '',
  ordem = 'Deal Rating',
  limite = 30,
  precoMaximo = null,
  pagina = 0,
  steamMin = 0,
  metacriticMin = 0,
  aaa = false,
} = {}) {
  const params = new URLSearchParams({ onSale: '1', pageSize: String(limite), sortBy: ordem, pageNumber: String(pagina) });
  if (termo) params.set('title', termo);
  if (steamMin) params.set('steamRating', String(steamMin));
  if (metacriticMin) params.set('metacritic', String(metacriticMin));
  if (aaa) params.set('AAA', '1');
  if (lojaId) params.set('storeID', lojaId);
  if (precoMaximo !== null) params.set('upperPrice', String(precoMaximo));
  const lista = await getJson(`${CHEAPSHARK}/api/1.0/deals?${params}`);
  return ajustarPrecosBR(lista.map(converter));
}

// Situação atual de uma promoção específica (usada para atualizar o preço de um destaque)
export async function buscarPromocaoPorId(dealID) {
  const dados = await getJson(`${CHEAPSHARK}/api/1.0/deals?id=${encodeURIComponent(idLimpo(dealID))}`);
  const info = dados.gameInfo;
  const normal = Number(info.retailPrice);
  const promocional = Number(info.salePrice);
  const [o] = await ajustarPrecosBR([
    {
      lojaId: info.storeID,
      steamAppID: info.steamAppID,
      precoNormal: normal,
      precoPromocional: promocional,
      desconto: normal > 0 ? Math.round((1 - promocional / normal) * 100) : 0,
    },
  ]);
  return { ...o, emPromocao: promocional < normal };
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
          link: linkDaPromocao(d.dealID, { lojaId: d.storeID, steamAppID: jogo.info.steamAppID }),
        });
      }
    }
  }
  return ajustarPrecosBR(resultado);
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
      steamAppID: dados.info?.steamAppID || null,
      precoNormal: normal,
      precoPromocional: preco,
      desconto: Math.round(Number(d.savings)) || 0,
      link: linkDaPromocao(dealID, { lojaId: d.storeID, steamAppID: dados.info?.steamAppID }),
    };
  });
  await ajustarPrecosBR(ofertas);
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

let cotacaoPromessa;
export function buscarCotacaoDolar() {
  cotacaoPromessa ??= getJson('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    .then((dados) => ({ valor: Number(dados.USDBRL.bid), atualizadoEm: dados.USDBRL.create_date }))
    .catch((erro) => {
      cotacaoPromessa = null; // tenta de novo na próxima
      throw erro;
    });
  return cotacaoPromessa;
}

// ---------- Preço real da Steam Brasil ----------
// A CheapShark dá o preço em dólar da Steam dos EUA. No Brasil a Steam tem preço regional (em reais),
// quase sempre menor que "dólar × cotação" — era por isso que o site mostrava preços acima do real.
// Para as ofertas da Steam, busca o preço em reais (via /api/precos-steam) e o guarda "em dólar
// equivalente" (reais ÷ cotação), assim o resto do site continua igual e mostra o valor exato em R$.
const precosBR = new Map(); // appID → { em, preco }
const VALIDADE_PRECO = 10 * 60 * 1000;

async function buscarPrecosSteamBR(apps) {
  const faltam = apps.filter((a) => !precosBR.has(a) || Date.now() - precosBR.get(a).em > VALIDADE_PRECO);
  for (let i = 0; i < faltam.length; i += 100) {
    const lote = faltam.slice(i, i + 100);
    try {
      const dados = await getJson(`/api/precos-steam?apps=${lote.join(',')}`);
      lote.forEach((a) => precosBR.set(a, { em: Date.now(), preco: dados[a] || null }));
    } catch {
      return; // sem a função do Vercel (ex.: npm run dev): fica a conversão pelo dólar
    }
  }
}

const ehSteam = (o) => String(o.lojaId) === LOJA_STEAM && Number(o.steamAppID) > 0;

export async function ajustarPrecosBR(lista) {
  const apps = [...new Set(lista.filter(ehSteam).map((o) => String(o.steamAppID)))];
  if (!apps.length) return lista;
  let cotacao;
  try {
    [cotacao] = await Promise.all([buscarCotacaoDolar().then((c) => c.valor), buscarPrecosSteamBR(apps)]);
  } catch {
    return lista;
  }
  if (!(cotacao > 0)) return lista;
  for (const o of lista) {
    if (!ehSteam(o)) continue;
    const br = precosBR.get(String(o.steamAppID))?.preco;
    if (!br) continue;
    o.precoPromocional = br.final / cotacao;
    o.precoNormal = (br.inicial || br.final) / cotacao;
    o.desconto = br.desconto;
    o.precoBR = true; // preço oficial em reais (não é conversão)
  }
  return lista;
}

// ---------- Relevância ----------
// "Mais relevantes": o quanto o jogo importa na plataforma, e não só o preço.
// Popularidade (nº de avaliações na Steam, em escala log) + nota na Steam + Metacritic + um pouco do desconto.
export function relevancia(p) {
  const popularidade = Math.log10((p.avaliacoes || 0) + 1); // 0 a ~6,5 (milhões de avaliações)
  const nota = p.avaliacaoPct ? (p.avaliacaoPct - 50) / 50 : 0; // -1 a 1
  const critica = p.metacritic ? (p.metacritic - 60) / 40 : 0; // ~-1 a 1
  return popularidade * 1.6 + nota * 2 + critica * 1.5 + (p.desconto || 0) / 100;
}

export const ordenarPorRelevancia = (lista) => [...lista].sort((a, b) => relevancia(b) - relevancia(a));

// Promoções mais relevantes de uma loja: junta as de melhor custo-benefício com as mais bem avaliadas
// e ordena pela relevância (assim jogos grandes e populares aparecem antes de jogos obscuros baratos)
export async function buscarMaisRelevantes({ lojaId = '', limite = 20, termo = '' } = {}) {
  const [custo, avaliados] = await Promise.all([
    buscarPromocoes({ lojaId, termo, ordem: 'Deal Rating', limite: 60 }),
    buscarPromocoes({ lojaId, termo, ordem: 'Reviews', limite: 60 }).catch(() => []),
  ]);
  const unicos = new Map();
  for (const p of [...custo, ...avaliados]) if (!unicos.has(p.dealID)) unicos.set(p.dealID, p);
  return ordenarPorRelevancia([...unicos.values()]).slice(0, limite);
}
