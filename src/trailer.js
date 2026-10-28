// Trailer ao passar o mouse: em qualquer cartão de jogo (e no banner), depois de um instante com o
// mouse em cima, a capa vira o trailer — sem som e em loop. Ao tirar o mouse, volta a capa.
// Fonte do vídeo: o link que o admin atrelou ao destaque (YouTube, .mp4 ou .webm) ou, se não houver,
// o trailer curto da Steam (via /api/trailer). Só em aparelhos com mouse (no celular não há "hover").

const ESPERA = 450; // ms com o mouse parado em cima antes de começar
const cacheSteam = new Map(); // appID → Promise<fontes[]>

export function idYoutube(url = '') {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function videoValido(url = '') {
  return Boolean(idYoutube(url)) || /^https?:\/\/\S+\.(mp4|webm|m4v|mov)(\?\S*)?$/i.test(String(url).trim());
}

async function fontesSteam(app) {
  if (!cacheSteam.has(app)) {
    cacheSteam.set(
      app,
      fetch(`/api/trailer?app=${encodeURIComponent(app)}`)
        .then((r) => (r.ok ? r.json() : { fontes: [] }))
        .then((d) => d.fontes || [])
        .catch(() => []),
    );
  }
  return cacheSteam.get(app);
}

// Descobre o vídeo: { youtube } ou { fontes: [{ url, tipo }] } ou null
export async function videoDoJogo({ video = '', steam = '' } = {}) {
  const yt = idYoutube(video);
  if (yt) return { youtube: yt };
  if (video) return { fontes: [{ url: video, tipo: /\.webm/i.test(video) ? 'video/webm' : 'video/mp4' }] };
  if (steam) {
    const fontes = await fontesSteam(steam);
    if (fontes.length) return { fontes };
  }
  return null;
}

function elementoDoVideo(info) {
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
  info.fontes.forEach((f) => {
    const s = document.createElement('source');
    s.src = f.url;
    if (f.tipo) s.type = f.tipo;
    v.append(s);
  });
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
    setTimeout(() => el.remove(), 300); // some com fade
    if (el.pause) el.pause();
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
    atual.el = elementoDoVideo(info);
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
