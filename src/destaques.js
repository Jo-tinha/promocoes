// Destaques: promoções escolhidas a dedo pelo admin (coleção "destaques").
// Também mantém "jogos": todo jogo que já foi destaque, para a lista do Notificar.
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

const colDestaques = collection(db, 'destaques');
const colJogos = collection(db, 'jogos');

// IDs de documento não podem ter "/"
const idDoc = (dealID) => dealID.replaceAll('/', '_');

// C — Destacar
export async function destacar(p, comentario = '') {
  await setDoc(doc(db, 'destaques', idDoc(p.dealID)), {
    dealID: p.dealID,
    gameID: p.gameID,
    titulo: p.titulo,
    lojaId: p.lojaId,
    precoNormal: p.precoNormal,
    precoPromocional: p.precoPromocional,
    desconto: p.desconto,
    imagem: p.imagem,
    avaliacao: p.avaliacao || '',
    avaliacaoPct: p.avaliacaoPct || 0,
    metacritic: p.metacritic || 0,
    link: p.link,
    comentario: comentario.trim(),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  if (p.gameID) {
    await setDoc(
      doc(db, 'jogos', p.gameID),
      { gameID: p.gameID, titulo: p.titulo, imagem: p.imagem, ultimaPromocaoEm: serverTimestamp() },
      { merge: true },
    );
  }
}

// R
export async function listarDestaques() {
  const snap = await getDocs(query(colDestaques, orderBy('criadoEm', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// U — preço atual vindo da API, ou o comentário do admin
export async function atualizarDestaque(id, campos) {
  return updateDoc(doc(db, 'destaques', id), { ...campos, atualizadoEm: serverTimestamp() });
}

// D
export async function removerDestaque(id) {
  return deleteDoc(doc(db, 'destaques', id));
}

export async function listarJogos() {
  const snap = await getDocs(query(colJogos, orderBy('titulo')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
