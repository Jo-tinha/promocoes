// Trailer ao passar o mouse: em qualquer cartão de jogo (e no banner), depois de um instante com o
// mouse em cima, a capa vira o trailer — sem som e em loop. Ao tirar o mouse, volta a capa.
// Fonte do vídeo: o link que o admin atrelou ao destaque (YouTube, .mp4 ou .webm) ou, se não houver,
// o trailer da Steam em HD (via /api/trailer; o trailer curto fica de reserva). Só em aparelhos com mouse (no celular não há "hover").

const ESPERA = 450; // ms com o mouse parado em cima antes de começar
const cacheSteam = new Map(); // appID → Promise<{ hls, fontes }>
const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
let carregandoHls;

// hls.js: toca o trailer em HD da Steam no Chrome/Firefox/Edge (o Safari toca HLS sozinho)
function carregarHls() {
  carregandoHls ??= new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = HLS_JS;
    s.async = true;
    s.onload = () => (window.Hls ? ok(window.Hls) : falha(new Error('hls.js não carregou')));
    s.onerror = falha;
    document.head.append(s);
  });
  return carregandoHls;
}

export function idYoutube(url = '') {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export const SEM_VIDEO = 'nenhum'; // o admin escolheu não ter vídeo nesse destaque

export function videoValido(url = '') {
  if (url === SEM_VIDEO) return true;
  return Boolean(idYoutube(url)) || /^https?:\/\/\S+\.(mp4|webm|m4v|mov)(\?\S*)?$/i.test(String(url).trim());
}

async function fontesSteam(app) {
  if (!cacheSteam.has(app)) {
    cacheSteam.set(
      app,
      fetch(`/api/trailer?app=${encodeURIComponent(app)}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => ({ hls: d.hls || null, fontes: d.fontes || [] }))
        .catch(() => ({ hls: null, fontes: [] })),
    );
  }
  return cacheSteam.get(app);
}

// Descobre o vídeo: { youtube } ou { fontes: [{ url, tipo }] } ou null
export async function videoDoJogo({ video = '', steam = '' } = {}) {
  if (video === SEM_VIDEO) return null;
  const yt = idYoutube(video);
  if (yt) return { youtube: yt };
  if (video) return { fontes: [{ url: video, tipo: /\.webm/i.test(video) ? 'video/webm' : 'video/mp4' }] };
  if (steam) {
    const { hls, fontes } = await fontesSteam(steam);
    if (hls || fontes.length) return { hls, fontes };
  }
  return null;
}

// Vídeo em HD: escolhe a resolução pelo tamanho em que vai aparecer (no mínimo 720p) e começa
// alguns segundos depois do início, pulando logos e classificação indicativa
async function tocarHls(v, url, palco) {
  const alturaTela = Math.max(720, Math.round((palco.clientHeight || 300) * (devicePixelRatio || 1)));
  const pular = () => {
    if (v.duration > 40) v.currentTime = Math.min(8, v.duration * 0.1);
  };
  v.addEventListener('loadedmetadata', pular, { once: true });
  const nativo = () => {
    if (!v.canPlayType('application/vnd.apple.mpegurl')) throw new Error('HLS sem suporte');
    v.addEventListener('error', () => v.dispatchEvent(new Event('hls-falhou')), { once: true });
    v.src = url; // Safari/iPhone: toca HLS sozinho
    v.play().catch(() => {});
  };
  // hls.js primeiro: ele deixa escolher a resolução (o player nativo começa em baixa qualidade)
  let Hls;
  try {
    Hls = await carregarHls();
  } catch {
    return nativo();
  }
  if (!Hls.isSupported()) return nativo();
  const hls = new Hls({ capLevelToPlayerSize: false, maxBufferLength: 20, startFragPrefetch: true });
  v._hls = hls;
  hls.on(Hls.Events.MANIFEST_PARSED, (_, dados) => {
    // a maior resolução até a altura em que o vídeo aparece (ex.: 1080p no banner, 720p nos cartões)
    const niveis = dados.levels.map((n, i) => ({ i, h: n.height || 0 })).sort((a, b) => a.h - b.h);
    const alvo = niveis.filter((n) => n.h <= alturaTela).pop() || niveis[0];
    if (alvo) {
      hls.startLevel = alvo.i;
      hls.nextLevel = alvo.i;
    }
    v.play().catch(() => {});
  });
  hls.on(Hls.Events.ERROR, (_, erro) => {
    if (erro.fatal) v.dispatchEvent(new Event('hls-falhou'));
  });
  hls.loadSource(url);
  hls.attachMedia(v);
}

export function elementoDoVideo(info, palco) {
  if (info.youtube) {
    const id = info.youtube;
    const f = document.createElement('iframe');
    f.className = 'trailer';
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0&disablekb=1`;
    f.allow = 'autoplay; encrypted-media';
    f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    f.addEventListener('load', () => setTimeout(() => f.classList.add('tocando'), 600)); // espera o player começar
    return f;
  }
  const v = document.createElement('video');
  v.className = 'trailer';
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.setAttribute('aria-hidden', 'true');
  const usarArquivos = () => {
    v._hls?.destroy();
    v.removeAttribute('src');
    (info.fontes || []).forEach((f) => {
      const s = document.createElement('source');
      s.src = f.url;
      if (f.tipo) s.type = f.tipo;
      v.append(s);
    });
    v.load();
    v.play().catch(() => {});
  };
  if (info.hls) {
    // HD primeiro; se o streaming falhar, cai para o arquivo curto
    v.addEventListener('hls-falhou', usarArquivos, { once: true });
    tocarHls(v, info.hls, palco).catch(usarArquivos);
  } else usarArquivos();
  v.addEventListener('playing', () => v.classList.add('tocando'), { once: true });
  return v;
}

let ativo = null; // { alvo, palco, el, timer }

export function pararTrailer() {
  if (!ativo) return;
  clearTimeout(ativo.timer);
  const { el, alvo } = ativo;
  alvo.classList.remove('com-trailer');
  if (el) {
    el.classList.remove('tocando');
    if (el.pause) el.pause();
    setTimeout(() => {
      el._hls?.destroy(); // para de baixar o streaming
      el.remove();
    }, 300); // some com fade
  }
  ativo = null;
}

function iniciar(alvo) {
  if (ativo?.alvo === alvo) return;
  pararTrailer();
  const palco = alvo.matches('.billboard') ? alvo.querySelector('.billboard-fundo') : alvo.querySelector('.jogo-capa');
  if (!palco) return;
  const dados = { video: alvo.dataset.video || '', steam: alvo.dataset.steam || '' };
  if (!dados.video && !dados.steam) return;
  const atual = { alvo, palco, el: null, timer: 0 };
  ativo = atual;
  atual.timer = setTimeout(async () => {
    const info = await videoDoJogo(dados);
    if (ativo !== atual || !info) return; // o mouse já saiu ou não há trailer
    atual.el = elementoDoVideo(info, palco);
    // logo depois da imagem: selos de desconto e da loja continuam por cima do vídeo
    const imgs = palco.querySelectorAll(':scope > img');
    if (imgs.length) imgs[imgs.length - 1].after(atual.el);
    else palco.append(atual.el);
    alvo.classList.add('com-trailer');
    atual.el.play?.().catch(() => {});
  }, ESPERA);
}

export function ativarTrailers() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('pointerover', (e) => {
    const alvo = e.target.closest?.('.jogo[data-steam], .jogo[data-video], .billboard[data-steam], .billboard[data-video]');
    if (alvo) iniciar(alvo);
  });
  document.addEventListener('pointerout', (e) => {
    if (!ativo) return;
    if (!ativo.alvo.contains(e.relatedTarget)) pararTrailer();
  });
  // rolou a página ou trocou de aba: para
  addEventListener('blur', pararTrailer);
}
