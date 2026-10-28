// Escolha do vídeo de um destaque (painel): trailer da Steam, YouTube, arquivo .mp4/.webm ou sem vídeo,
// com prévia tocando como aparece no cartão quando passam o mouse.
import { idSteam } from './lojas.js';
import { videoDoJogo, idYoutube, elementoDoVideo, SEM_VIDEO } from './trailer.js';
import { esc } from './util.js';

const OPCOES = [
  { id: 'steam', icone: '🎬', rotulo: 'Trailer da Steam', nota: 'automático, em HD' },
  { id: 'youtube', icone: '▶️', rotulo: 'YouTube', nota: 'link de um vídeo' },
  { id: 'arquivo', icone: '📁', rotulo: 'Arquivo de vídeo', nota: '.mp4 ou .webm' },
  { id: 'nenhum', icone: '🚫', rotulo: 'Sem vídeo', nota: 'só a imagem' },
];

const tipoDoValor = (v, temSteam) =>
  v === SEM_VIDEO ? 'nenhum' : idYoutube(v) ? 'youtube' : v ? 'arquivo' : temSteam ? 'steam' : 'nenhum';

const arquivoValido = (u) => /^https?:\/\/\S+\.(mp4|webm|m4v|mov)(\?\S*)?$/i.test(u);

export function campoVideo({ nome = 'video', valor = '', jogo }) {
  const temSteam = Boolean(jogo && !jogo.manual && idSteam(jogo));
  const tipo = tipoDoValor(valor, temSteam);
  return `
    <div class="campo-video" data-campo-video data-steam="${esc(temSteam ? idSteam(jogo) : '')}">
      <input type="hidden" name="${nome}" value="${esc(valor)}" />
      <div class="opcoes-video" role="radiogroup" aria-label="Fonte do vídeo">
        ${OPCOES.map(
          (o) => `
          <button type="button" class="opcao-video" role="radio" data-tipo="${o.id}" aria-checked="${o.id === tipo}"
                  ${o.id === 'steam' && !temSteam ? 'disabled title="Este jogo não tem página na Steam"' : ''}>
            <span class="opcao-video-icone" aria-hidden="true">${o.icone}</span>
            <strong>${o.rotulo}</strong>
            <small>${o.id === 'steam' && !temSteam ? 'indisponível' : o.nota}</small>
          </button>`,
        ).join('')}
      </div>
      <label class="video-link" data-link hidden>
        <span data-link-rotulo>Link</span>
        <input type="url" data-url value="${esc(valor === SEM_VIDEO ? '' : valor)}" />
        <small data-link-ajuda></small>
      </label>
      <div class="video-previa-area">
        <div class="video-previa jogo-capa" data-previa><span class="video-previa-vazia" data-vazia>Sem vídeo</span></div>
        <div class="video-previa-texto">
          <span class="editor-previa-rotulo">Prévia no cartão</span>
          <p class="situacao-imagem" data-situacao role="status"></p>
          <p class="secao-nota">O vídeo toca sem som e em loop quando a pessoa para o mouse em cima do cartão ou do banner. No celular aparece só a imagem.</p>
        </div>
      </div>
    </div>`;
}

export function ativarCampoVideo(raiz) {
  for (const campo of raiz.querySelectorAll('[data-campo-video]')) {
    if (campo.dataset.ativo) continue;
    campo.dataset.ativo = '1';
    const oculto = campo.querySelector('input[type="hidden"]');
    const link = campo.querySelector('[data-link]');
    const url = campo.querySelector('[data-url]');
    const previa = campo.querySelector('[data-previa]');
    const vazia = campo.querySelector('[data-vazia]');
    const situacao = campo.querySelector('[data-situacao]');
    const steam = campo.dataset.steam;
    let tipo = campo.querySelector('[aria-checked="true"]')?.dataset.tipo || 'nenhum';
    let vez = 0;

    const avisar = (texto, nivel = '') => {
      situacao.textContent = texto;
      situacao.className = `situacao-imagem${nivel ? ` nivel-${nivel}` : ''}`;
    };
    const limparPrevia = () => {
      previa.querySelectorAll('.trailer').forEach((el) => {
        el.pause?.();
        el._hls?.destroy();
        el.remove();
      });
    };
    const tocar = (info) => {
      limparPrevia();
      if (!info) return (vazia.hidden = false);
      vazia.hidden = true;
      const el = elementoDoVideo(info, previa);
      previa.append(el);
      el.play?.().catch(() => {});
    };

    async function atualizar() {
      const minha = ++vez;
      campo.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tipo === tipo)));
      link.hidden = tipo !== 'youtube' && tipo !== 'arquivo';
      campo.querySelector('[data-link-rotulo]').textContent = tipo === 'youtube' ? 'Link do vídeo no YouTube' : 'Link direto do arquivo de vídeo';
      url.placeholder = tipo === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…/trailer.mp4';
      campo.querySelector('[data-link-ajuda]').textContent =
        tipo === 'youtube'
          ? 'Aceita links do tipo youtube.com/watch?v=…, youtu.be/… e youtube.com/shorts/…'
          : 'O link precisa terminar em .mp4 ou .webm e abrir o vídeo direto (não a página de um site). Prefira 720p ou 1080p.';
      const v = url.value.trim();

      if (tipo === 'nenhum') {
        oculto.value = SEM_VIDEO;
        tocar(null);
        return avisar('Este destaque fica sem vídeo: aparece só a imagem.');
      }
      if (tipo === 'steam') {
        oculto.value = '';
        avisar('Procurando o trailer na Steam…');
        const info = await videoDoJogo({ steam });
        if (minha !== vez) return;
        tocar(info);
        return info
          ? avisar('✓ Trailer da Steam encontrado (em HD).', 'ok')
          : avisar('Não achei trailer na Steam para este jogo (ou o site está rodando sem o Vercel). Escolha YouTube ou um arquivo.', 'aviso');
      }
      if (!v) {
        oculto.value = '';
        tocar(null);
        return avisar(tipo === 'youtube' ? 'Cole o link do vídeo do YouTube.' : 'Cole o link do arquivo .mp4 ou .webm.');
      }
      if (tipo === 'youtube' && !idYoutube(v)) {
        tocar(null);
        return avisar('✕ Isso não parece um link de vídeo do YouTube.', 'erro');
      }
      if (tipo === 'arquivo' && !arquivoValido(v)) {
        tocar(null);
        return avisar('✕ O link precisa terminar em .mp4 ou .webm (arquivo de vídeo, não a página).', 'erro');
      }
      oculto.value = v;
      const info = await videoDoJogo({ video: v });
      if (minha !== vez) return;
      tocar(info);
      avisar(tipo === 'youtube' ? `✓ Vídeo do YouTube (${idYoutube(v)}).` : '✓ Arquivo de vídeo. Se a prévia não tocar, confira se o link é público.', 'ok');
    }

    campo.querySelector('.opcoes-video').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tipo]');
      if (!b || b.disabled) return;
      if (tipo !== b.dataset.tipo && (b.dataset.tipo === 'youtube') !== (tipo === 'youtube')) url.value = '';
      tipo = b.dataset.tipo;
      atualizar();
      if (!link.hidden) url.focus();
    });
    let espera;
    url.addEventListener('input', () => {
      clearTimeout(espera);
      espera = setTimeout(atualizar, 350);
    });
    campo.videoComErro = () => (tipo === 'youtube' || tipo === 'arquivo') && Boolean(url.value.trim()) && !oculto.value;
    campo.pararPrevia = limparPrevia;
    atualizar();
  }
}

export const videoComErro = (raiz) => [...raiz.querySelectorAll('[data-campo-video]')].some((c) => c.videoComErro?.());
export const pararPrevias = (raiz) => raiz.querySelectorAll('[data-campo-video]').forEach((c) => c.pararPrevia?.());

// Janela só do vídeo (substitui o prompt() do navegador). Devolve o valor ou null (cancelou).
export function abrirEditorVideo(jogo) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo-destacar dialogo-video';
    dialogo.innerHTML = `
      <form method="dialog" class="destacar-conteudo" novalidate>
        <header class="destacar-topo">
          <div><span class="selo-tipo">Vídeo do destaque</span><h2>${esc(jogo.titulo)}</h2></div>
          <button class="escolha-fechar" type="button" data-cancelar aria-label="Fechar">×</button>
        </header>
        ${campoVideo({ valor: jogo.video || '', jogo })}
        <p class="mensagem erro" data-erro hidden></p>
        <footer class="form-acoes">
          <button class="botao secundario" type="button" data-cancelar>Cancelar</button>
          <button class="botao" type="submit">Salvar vídeo</button>
        </footer>
      </form>`;
    document.body.append(dialogo);
    const fechar = (r) => {
      pararPrevias(dialogo);
      dialogo.close();
      dialogo.remove();
      resolver(r);
    };
    dialogo.addEventListener('cancel', (e) => {
      e.preventDefault();
      fechar(null);
    });
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-cancelar]')) fechar(null);
    });
    dialogo.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (videoComErro(dialogo)) {
        const erro = dialogo.querySelector('[data-erro]');
        erro.textContent = 'O link do vídeo não é válido. Corrija ou escolha outra opção.';
        erro.hidden = false;
        return;
      }
      fechar(dialogo.querySelector('input[name="video"]').value);
    });
    ativarCampoVideo(dialogo);
    dialogo.showModal();
  });
}
