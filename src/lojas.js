// Identidade visual de cada loja (IDs da CheapShark) e ordem em que aparecem na vitrine
export const ESTILO_LOJAS = {
  1: { cor: '#66c0f4', fundo: '#1b2838' }, // Steam
  25: { cor: '#2f8cff', fundo: '#121212' }, // Epic Games Store
  7: { cor: '#b14bd8', fundo: '#2a0e33' }, // GOG
  11: { cor: '#ff4a4a', fundo: '#2b0d0d' }, // Humble Store
  15: { cor: '#ff9a1f', fundo: '#2b1a05' }, // Fanatical
  3: { cor: '#20e070', fundo: '#062615' }, // Green Man Gaming
  13: { cor: '#3aa0ff', fundo: '#071a33' }, // Ubisoft
  8: { cor: '#ff5a4f', fundo: '#2a0f0d' }, // EA
  27: { cor: '#00b2ff', fundo: '#03202e' }, // Gamesplanet
  2: { cor: '#3fa9f5', fundo: '#0b1d2e' }, // GamersGate
  31: { cor: '#00aeff', fundo: '#04192a' }, // Blizzard
  30: { cor: '#ff5a5f', fundo: '#2b0f10' }, // IndieGala
  29: { cor: '#ff2d6f', fundo: '#2b0816' }, // 2Game
  23: { cor: '#f9b233', fundo: '#2b1f06' }, // GameBillet
  24: { cor: '#ff3d9a', fundo: '#2b0a1b' }, // Voidu
  21: { cor: '#3ddc84', fundo: '#0a2617' }, // WinGameStore
  33: { cor: '#f5a623', fundo: '#2b1d06' }, // DLGamer
  34: { cor: '#a66bff', fundo: '#1c0f33' }, // Noctre
  35: { cor: '#ff7a1a', fundo: '#2b1404' }, // DreamGame
  28: { cor: '#ff3b3b', fundo: '#2b0a0a' }, // Gamesload
};

const PADRAO = { cor: '#ff5c35', fundo: '#1e2330' };

export const ORDEM_LOJAS = ['1', '25', '7', '11', '15', '3', '13', '8', '27', '2', '31', '30', '29', '23', '24', '21', '33', '34', '35', '28'];

export function estiloDaLoja(id) {
  return ESTILO_LOJAS[id] || PADRAO;
}

// Variáveis CSS para pintar um elemento com as cores da loja
export function varsDaLoja(id) {
  const { cor, fundo } = estiloDaLoja(id);
  return `--cor-loja:${cor};--fundo-loja:${fundo}`;
}

// Brindes da GamerPower informam a plataforma em texto ("PC, Epic Games Store") → loja da CheapShark
export function lojaPelaPlataforma(texto = '') {
  const t = texto.toLowerCase();
  if (t.includes('epic')) return '25';
  if (t.includes('gog')) return '7';
  if (t.includes('steam')) return '1';
  if (t.includes('ubisoft')) return '13';
  if (t.includes('humble')) return '11';
  return '';
}

// As miniaturas da CheapShark são pequenas. Para cada loja conhecida, tenta versões maiores
// da mesma imagem (a miniatura original fica por último, como garantia).
export function versoesMaiores(url = '') {
  if (!url) return [];
  const versoes = [];
  // Steam: capsule_sm_120 / capsule_184x69 / capsule_231x87 → header (460×215)
  if (/steamstatic|steampowered|steamcdn/.test(url)) {
    versoes.push(url.replace(/capsule_(sm_120|184x69|231x87|231x87_alt_assets_\d+)\.jpg/, 'header.jpg'));
  }
  // GOG: o sufixo (_196, _100 etc.) define o tamanho; sem ele vem a imagem original
  const gog = url.match(/^(https?:\/\/images[-\d]*\.gog(?:-statics)?\.com\/[0-9a-f]+)(?:_[\w]+)?\.(?:jpg|png|webp)/i);
  if (gog) versoes.push(`${gog[1]}_product_card_v2_mobile_slider_639.jpg`, `${gog[1]}.jpg`);
  // Epic: o CDN aceita redimensionar pela URL
  if (/cdn\d*\.epicgames\.com|epicgames\.com\/offer/.test(url)) {
    const base = url.split('?')[0];
    versoes.push(`${base}?h=480&quality=high&resize=1&w=854`);
  }
  versoes.push(url);
  return [...new Set(versoes)];
}

export const imagemGrande = (url = '') => versoesMaiores(url)[0] || url;

// ---------- Imagens em alta resolução ----------
// A CheapShark informa o ID do jogo na Steam (steamAppID), mesmo quando a promoção é de outra loja.
// Com ele, usamos a arte oficial da Steam: 1920 px no banner e 616 px nos cartões.
const STEAM_CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';
const STEAM_CDN_ANTIGO = 'https://cdn.akamai.steamstatic.com/steam/apps';
const PIXEL_VAZIO =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 4 3%27%3E%3Crect width=%274%27 height=%273%27 fill=%27%23171b24%27/%3E%3C/svg%3E';

export function idSteam(p) {
  if (p.steamAppID) return String(p.steamAppID);
  const m = String(p.imagem || '').match(/\/apps\/(\d+)\//);
  return m ? m[1] : null;
}

function fontesDaImagem(p, tipo) {
  if (p.manual) {
    const fontes = tipo === 'banner' ? [p.imagemBanner, p.imagem] : [p.imagem, p.imagemBanner];
    return [...new Set([...fontes.filter(Boolean), PIXEL_VAZIO])];
  }
  const id = idSteam(p);
  const fontes = [];
  if (id) {
    // caminho novo e o antigo do CDN da Steam (alguns jogos só têm um deles)
    if (tipo === 'banner') fontes.push(`${STEAM_CDN}/${id}/library_hero.jpg`, `${STEAM_CDN_ANTIGO}/${id}/library_hero.jpg`);
    fontes.push(`${STEAM_CDN}/${id}/capsule_616x353.jpg`, `${STEAM_CDN_ANTIGO}/${id}/capsule_616x353.jpg`, `${STEAM_CDN}/${id}/header.jpg`);
  }
  if (p.imagem) fontes.push(...versoesMaiores(p.imagem));
  fontes.push(PIXEL_VAZIO);
  return [...new Set(fontes)];
}

const aspas = (t) => String(t).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

// URL que funcionou para cada imagem (chave = primeira opção). Evita repetir as tentativas que falham
// a cada redesenho — era isso que fazia as imagens "tremerem".
const imagemQueFuncionou = new Map();

// <img> que tenta a melhor imagem e, se ela não existir, passa para a próxima da lista.
// Fica transparente até uma delas carregar e aparece com um fade (as trocas não ficam visíveis).
export function imgJogo(p, tipo = 'cartao', atributos = 'loading="lazy"') {
  const fontes = fontesDaImagem(p, tipo);
  const chave = fontes[0];
  const certa = imagemQueFuncionou.get(chave);
  if (certa) return `<img class="img-jogo carregada" src="${aspas(certa)}" onload="imagemCarregou(this)" alt="" ${atributos} />`;
  const [primeira, ...resto] = fontes;
  return `<img class="img-jogo" src="${aspas(primeira)}" data-chave="${aspas(chave)}" data-alternativas="${aspas(resto.join('|'))}"
    onload="imagemCarregou(this)" onerror="proximaImagem(this)" alt="" ${atributos} />`;
}

if (typeof window !== 'undefined') {
  window.imagemCarregou = (img) => {
    img.classList.add('carregada');
    if (img.dataset.chave) imagemQueFuncionou.set(img.dataset.chave, img.currentSrc || img.src);
    marcarBaixaResolucao(img);
  };
  // Só existe a miniatura (jogo fora da Steam)? Em vez de esticá-la e borrar, mostra a imagem
  // inteira, sem ampliar demais, sobre um fundo desfocado dela mesma.
  const marcarBaixaResolucao = (img) => {
    const capa = img.closest('.jogo-capa, .escolha-capa');
    if (!capa || img.src.startsWith('data:')) return;
    const largura = capa.clientWidth || 300;
    const pequena = img.naturalWidth > 0 && img.naturalWidth < largura * 0.75;
    capa.classList.toggle('capa-baixa-res', pequena);
    if (!pequena) return;
    capa.style.setProperty('--capa-fundo', `url("${(img.currentSrc || img.src).replaceAll('"', '%22')}")`);
    capa.style.setProperty('--capa-largura', `${Math.round(Math.min(largura * 0.86, img.naturalWidth * 1.6))}px`);
  };
  window.proximaImagem = (img) => {
    const resto = (img.dataset.alternativas || '').split('|').filter(Boolean);
    if (!resto.length) {
      img.onerror = null;
      img.classList.add('carregada'); // nenhuma funcionou: mostra o fundo vazio
      return;
    }
    img.dataset.alternativas = resto.slice(1).join('|');
    img.src = resto[0];
  };
}
