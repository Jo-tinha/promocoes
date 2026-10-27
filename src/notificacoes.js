// Notificações do navegador para os jogos estrelados.
// Funcionam enquanto o Buba Promo estiver aberto em alguma aba (checagem ao abrir e a cada 15 minutos).
// Avisar com o navegador fechado exigiria um servidor de push, fora do escopo deste projeto.

const CHAVE_NOTIFICADOS = 'buba-notificados'; // promoções já notificadas neste navegador (evita repetir)

export const suportaNotificacoes = () => 'Notification' in window && 'serviceWorker' in navigator;
export const permissaoAtual = () => (suportaNotificacoes() ? Notification.permission : 'unsupported');

let registro;
async function registrarSW() {
  if (!('serviceWorker' in navigator)) return null;
  registro ??= navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);
  return registro;
}

// Pede a permissão (só depois de um clique do usuário, como os navegadores exigem)
export async function pedirPermissao() {
  if (!suportaNotificacoes()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  const resposta = await Notification.requestPermission();
  if (resposta === 'granted') {
    await registrarSW();
    await mostrar('Notificações ativadas', {
      body: 'Vamos avisar aqui quando um jogo estrelado entrar em promoção.',
      tag: 'buba-boas-vindas',
    });
  }
  return resposta;
}

async function mostrar(titulo, opcoes) {
  const sw = await registrarSW();
  const base = { icon: '/icone-192.png', badge: '/icone-192.png', lang: 'pt-BR' };
  if (sw?.showNotification) return sw.showNotification(titulo, { ...base, ...opcoes });
  return new Notification(titulo, { ...base, ...opcoes }); // navegadores sem service worker
}

function lerNotificados() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_NOTIFICADOS)) || []);
  } catch {
    return new Set();
  }
}

function gravarNotificados(conjunto) {
  try {
    localStorage.setItem(CHAVE_NOTIFICADOS, JSON.stringify([...conjunto].slice(-400)));
  } catch {
    /* ignora */
  }
}

// avisos: lista vinda de buscarAvisos (cada um com dealID, titulo, desconto, imagem, novo)
// precoTexto: função que formata o preço
export async function notificarNovos(avisos, precoTexto) {
  if (permissaoAtual() !== 'granted') return;
  const notificados = lerNotificados();
  const pendentes = avisos.filter((a) => a.novo && !notificados.has(a.dealID));
  if (!pendentes.length) return;

  if (pendentes.length > 3) {
    // muitos de uma vez: uma notificação só, resumida
    await mostrar(`${pendentes.length} jogos estrelados em promoção`, {
      body: pendentes.slice(0, 3).map((a) => `${a.titulo} (-${a.desconto}%)`).join(', ') + '…',
      tag: 'buba-resumo',
      data: { url: '/notificar.html' },
    });
  } else {
    for (const a of pendentes) {
      await mostrar(`⭐ ${a.titulo} em promoção!`, {
        body: `-${a.desconto}% · ${precoTexto(a.precoPromocional)}. Toque para ver.`,
        image: a.imagem,
        tag: `buba-${a.dealID}`,
        data: { url: a.link || '/notificar.html' },
      });
    }
  }
  pendentes.forEach((a) => notificados.add(a.dealID));
  gravarNotificados(notificados);
}

// Se a permissão já foi dada antes, registra o service worker ao abrir o site
export function prepararNotificacoes() {
  if (permissaoAtual() === 'granted') registrarSW();
}
