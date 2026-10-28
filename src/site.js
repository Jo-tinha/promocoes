// Partes comuns a todas as páginas: rodapé, aviso de cookies (LGPD) e botão "voltar ao topo"
import { ativarTrailers } from './trailer.js';

const CHAVE_CONSENTIMENTO = 'buba-consentimento';
const VERSAO_POLITICA = '2026-10-27';

// ---------- Consentimento ----------
function lerConsentimento() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CONSENTIMENTO));
    return salvo?.versao === VERSAO_POLITICA ? salvo : null;
  } catch {
    return null;
  }
}

function salvarConsentimento(preferencias) {
  const valor = { essenciais: true, preferencias, versao: VERSAO_POLITICA, data: new Date().toISOString() };
  try {
    localStorage.setItem(CHAVE_CONSENTIMENTO, JSON.stringify(valor));
    if (!preferencias) {
      // retirou o consentimento: apaga o que foi guardado como preferência
      Object.keys(localStorage)
        .filter((k) => k.startsWith('buba-pref-'))
        .forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    /* navegação privada sem armazenamento: segue sem salvar */
  }
  return valor;
}

// Usado pelas páginas antes de guardar uma preferência (ex.: última busca)
export function podeGuardarPreferencias() {
  return Boolean(lerConsentimento()?.preferencias);
}

export function guardarPreferencia(nome, valor) {
  if (!podeGuardarPreferencias()) return;
  try {
    localStorage.setItem(`buba-pref-${nome}`, JSON.stringify(valor));
  } catch {
    /* ignora */
  }
}

export function lerPreferencia(nome) {
  if (!podeGuardarPreferencias()) return null;
  try {
    return JSON.parse(localStorage.getItem(`buba-pref-${nome}`));
  } catch {
    return null;
  }
}

function montarAvisoCookies() {
  const aviso = document.createElement('div');
  aviso.className = 'cookies';
  aviso.setAttribute('role', 'dialog');
  aviso.setAttribute('aria-live', 'polite');
  aviso.setAttribute('aria-label', 'Aviso de cookies');
  aviso.innerHTML = `
    <div class="cookies-texto">
      <strong>🍪 Cookies e armazenamento local</strong>
      <p>Usamos o essencial para o site funcionar (como manter seu login) e, se você permitir, para lembrar preferências como a sua última busca.
      Não usamos cookies de publicidade nem de rastreamento. <a href="/privacidade.html#cookies">Saiba mais</a>.</p>
      <div class="cookies-opcoes" hidden>
        <label class="cookies-opcao">
          <input type="checkbox" checked disabled />
          <span><strong>Essenciais</strong> — login e segurança. Sempre ativos.</span>
        </label>
        <label class="cookies-opcao">
          <input type="checkbox" id="cookie-preferencias" />
          <span><strong>Preferências</strong> — lembrar a última busca neste aparelho.</span>
        </label>
      </div>
    </div>
    <div class="cookies-acoes">
      <button class="botao secundario pequeno" type="button" data-cookie="personalizar">Personalizar</button>
      <button class="botao secundario pequeno" type="button" data-cookie="essenciais">Só essenciais</button>
      <button class="botao pequeno" type="button" data-cookie="todos">Aceitar todos</button>
    </div>`;

  const opcoes = aviso.querySelector('.cookies-opcoes');
  const caixaPref = aviso.querySelector('#cookie-preferencias');
  caixaPref.checked = Boolean(lerConsentimento()?.preferencias);

  aviso.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-cookie]');
    if (!botao) return;
    const acao = botao.dataset.cookie;
    if (acao === 'personalizar') {
      opcoes.hidden = false;
      botao.dataset.cookie = 'salvar';
      botao.textContent = 'Salvar escolhas';
      return;
    }
    salvarConsentimento(acao === 'todos' || (acao === 'salvar' && caixaPref.checked));
    aviso.classList.add('saindo');
    setTimeout(() => aviso.remove(), 250);
  });
  document.body.append(aviso);
}

// Reabre o aviso (link "Preferências de cookies" no rodapé)
export function abrirPreferenciasCookies() {
  document.querySelector('.cookies')?.remove();
  montarAvisoCookies();
  document.querySelector('[data-cookie="personalizar"]')?.click();
}

// ---------- Rodapé ----------
function montarRodape() {
  const rodape = document.querySelector('#rodape');
  if (!rodape) return;
  const ano = new Date().getFullYear();
  rodape.className = 'rodape';
  rodape.innerHTML = `
    <div class="container rodape-grade">
      <div>
        <a class="marca" href="/">Buba <span>Promo</span></a>
        <p class="secao-nota">Promoções de jogos de PC, loja por loja, com preços em reais. Projeto integrador — Atividade 2.</p>
      </div>
      <nav aria-label="Navegação">
        <h3>Navegar</h3>
        <a href="/">Vitrine</a>
        <a href="/notificar.html">Notificar</a>
        <a href="/entrar.html">Entrar ou criar conta</a>
      </nav>
      <nav aria-label="Informações legais">
        <h3>Legal</h3>
        <a href="/privacidade.html">Política de privacidade</a>
        <a href="/privacidade.html#cookies">Política de cookies</a>
        <a href="/termos.html">Termos de uso</a>
        <button type="button" class="link-botao" id="abrir-cookies">Preferências de cookies</button>
      </nav>
      <div>
        <h3>Dados</h3>
        <p class="secao-nota">
          Promoções: <a href="https://www.cheapshark.com" target="_blank" rel="noopener">CheapShark</a><br />
          Jogos grátis: <a href="https://www.gamerpower.com" target="_blank" rel="noopener">GamerPower.com</a><br />
          Cotação: <a href="https://docs.awesomeapi.com.br/api-de-moedas" target="_blank" rel="noopener">AwesomeAPI</a>
        </p>
      </div>
    </div>
    <div class="container rodape-base">
      <span>© ${ano} Buba Promo. Não somos uma loja: os preços e a disponibilidade são definidos por cada loja e podem mudar sem aviso.</span>
      <span>Valores em reais convertidos pela cotação do dia; a cobrança final é feita pela loja.</span>
    </div>`;
  rodape.querySelector('#abrir-cookies').addEventListener('click', abrirPreferenciasCookies);
}

// ---------- Voltar ao topo ----------
function montarVoltarAoTopo() {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'voltar-topo';
  botao.setAttribute('aria-label', 'Voltar ao topo');
  botao.textContent = '↑';
  botao.hidden = true;
  botao.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.append(botao);
  addEventListener('scroll', () => (botao.hidden = scrollY < 700), { passive: true });
}

// ---------- Rodinha do mouse nas faixas (rolagem suave) ----------
// Com o mouse em cima de uma faixa de jogos, a rodinha rola a faixa para o lado, de forma suave:
// cada giro soma um "alvo" e a faixa desliza até ele, desacelerando no fim.
// Fora das faixas (laterais, entre as faixas) a rodinha rola a página normalmente.
// Quando a faixa chega ao fim, a rodinha volta a rolar a página.
function ativarRodinhaHorizontal() {
  const animacoes = new WeakMap(); // faixa → { alvo, quadro }
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)');

  function deslizar(faixa) {
    const a = animacoes.get(faixa);
    const atual = faixa.scrollLeft;
    const distancia = a.alvo - atual;
    if (Math.abs(distancia) < 0.6) {
      faixa.scrollLeft = a.alvo;
      a.quadro = null;
      // devolve a rolagem suave do CSS (usada pelas setas); o "encaixe" fica desligado nesta faixa,
      // senão ela daria um pulinho até o cartão mais próximo depois de parar
      faixa.style.scrollBehavior = '';
      return;
    }
    faixa.scrollLeft = atual + distancia * 0.16; // aproxima 16% por quadro: começa rápido e freia no fim
    a.quadro = requestAnimationFrame(() => deslizar(faixa));
  }

  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.shiftKey) return; // zoom, ou o navegador já rola de lado com Shift
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // trackpad já está rolando de lado
      const faixa = e.target.closest('.trilho, .atalhos-lojas');
      if (!faixa) return;
      const maximo = faixa.scrollWidth - faixa.clientWidth;
      if (maximo <= 1) return; // nada para rolar de lado
      const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * faixa.clientWidth : e.deltaY;

      const a = animacoes.get(faixa) || { alvo: faixa.scrollLeft, quadro: null };
      if (!a.quadro) a.alvo = faixa.scrollLeft; // começa do ponto atual se não estava animando
      const naPontaEsq = a.alvo <= 0;
      const naPontaDir = a.alvo >= maximo - 1;
      if ((delta < 0 && naPontaEsq) || (delta > 0 && naPontaDir)) return; // na ponta: deixa a página rolar

      e.preventDefault();
      a.alvo = Math.max(0, Math.min(maximo, a.alvo + delta * 1.4));
      animacoes.set(faixa, a);

      if (reduzir.matches) {
        faixa.scrollLeft = a.alvo; // quem prefere menos animação: vai direto
        return;
      }
      faixa.style.scrollSnapType = 'none'; // o encaixe brigaria com a animação
      faixa.style.scrollBehavior = 'auto';
      if (!a.quadro) a.quadro = requestAnimationFrame(() => deslizar(faixa));
    },
    { passive: false },
  );
}

let iniciado = false;
export function iniciarSite() {
  if (iniciado) return;
  iniciado = true;
  montarRodape();
  montarVoltarAoTopo();
  ativarRodinhaHorizontal();
  ativarTrailers(); // trailer ao passar o mouse nos cartões
  if (!lerConsentimento()) montarAvisoCookies();
}
