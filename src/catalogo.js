// Catálogo "Games": todo jogo que já apareceu em promoção no Buba Promo fica salvo na coleção "jogos".
// Usuários logados salvam automaticamente os jogos que veem (no máximo uma vez por dia por jogo neste
// navegador); o admin pode sincronizar centenas de uma vez pelo painel.
import { collection, doc, getDocs, writeBatch, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { buscarPromocoes } from './api.js';

const colJogos = collection(db, 'jogos');
const CHAVE_CACHE = 'buba-jogos-salvos'; // cache técnico: evita regravar o mesmo jogo várias vezes
const UM_DIA = 24 * 60 * 60 * 1000;

function lerCache() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CACHE)) || {};
  } catch {
    return {};
  }
}

function gravarCache(cache) {
  try {
    // mantém só o último mês para o cache não crescer sem limite
    const limite = Date.now() - 30 * UM_DIA;
    const enxuto = Object.fromEntries(Object.entries(cache).filter(([, t]) => t > limite));
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(enxuto));
  } catch {
    /* sem armazenamento: só perde o cache */
  }
}

// Campos aceitos pelas regras do Firestore (ver firestore.rules → jogoValido)
function paraFirestore(p) {
  return {
    gameID: p.gameID,
    titulo: String(p.titulo).slice(0, 190),
    imagem: String(p.imagem || '').slice(0, 490),
    steamAppID: String(p.steamAppID || '').slice(0, 12),
    lojaId: String(p.lojaId || ''),
    ultimoPreco: Number(p.precoPromocional) || 0,
    ultimoPrecoNormal: Number(p.precoNormal) || 0,
    ultimoDesconto: Number(p.desconto) || 0,
    ultimaPromocaoEm: serverTimestamp(),
  };
}

async function gravarEmLotes(promos) {
  // o Firestore aceita até 500 operações por lote
  for (let i = 0; i < promos.length; i += 400) {
    const lote = writeBatch(db);
    promos.slice(i, i + 400).forEach((p) => lote.set(doc(db, 'jogos', p.gameID), paraFirestore(p), { merge: true }));
    await lote.commit();
  }
}

const jaSalvosNestaVisita = new Set();

// Chamado pelas páginas sempre que exibem promoções. Só grava se houver usuário logado.
export async function salvarNoCatalogo(promos) {
  if (!auth.currentUser) return;
  const cache = lerCache();
  const agora = Date.now();
  const novos = [];
  for (const p of promos) {
    if (!p.gameID || jaSalvosNestaVisita.has(p.gameID)) continue;
    jaSalvosNestaVisita.add(p.gameID);
    if (cache[p.gameID] && agora - cache[p.gameID] < UM_DIA) continue;
    novos.push(p);
  }
  if (!novos.length) return;
  try {
    await gravarEmLotes(novos);
    novos.forEach((p) => (cache[p.gameID] = agora));
    gravarCache(cache);
  } catch (erro) {
    console.warn('Não foi possível salvar jogos no catálogo:', erro);
  }
}

export async function listarCatalogo() {
  const snap = await getDocs(query(colJogos, orderBy('titulo')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Admin: puxa várias páginas de promoções da CheapShark e grava tudo no catálogo
export async function sincronizarCatalogo({ paginas = 10, aoProgredir } = {}) {
  let total = 0;
  for (let pagina = 0; pagina < paginas; pagina++) {
    const lista = (await buscarPromocoes({ ordem: 'Recent', limite: 60, pagina })).filter((p) => p.gameID);
    if (!lista.length) break;
    await gravarEmLotes(lista);
    total += lista.length;
    aoProgredir?.(pagina + 1, paginas, total);
  }
  return total;
}
