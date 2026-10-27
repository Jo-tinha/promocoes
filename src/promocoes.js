// Promoções aprovadas pelo admin (coleção "promocoes") e a lista de jogos que já estiveram em oferta (coleção "jogos")
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const colPromocoes = collection(db, 'promocoes');
const colJogos = collection(db, 'jogos');

// IDs de documento não podem ter "/"
const idDoc = (dealID) => dealID.replaceAll('/', '_');

// C — Aprovar: a promoção entra na aplicação e o jogo passa a constar na lista "já esteve em oferta"
export async function aprovarPromocao(p) {
  await setDoc(doc(db, 'promocoes', idDoc(p.dealID)), {
    dealID: p.dealID,
    gameID: p.gameID,
    titulo: p.titulo,
    lojaId: p.lojaId,
    precoNormal: p.precoNormal,
    precoPromocional: p.precoPromocional,
    desconto: p.desconto,
    imagem: p.imagem,
    link: p.link,
    aprovadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await setDoc(
    doc(db, 'jogos', p.gameID),
    { gameID: p.gameID, titulo: p.titulo, imagem: p.imagem, ultimaPromocaoEm: serverTimestamp() },
    { merge: true },
  );
}

// R — Consultar
export async function listarPromocoes() {
  const snap = await getDocs(query(colPromocoes, orderBy('aprovadoEm', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Promoções de uma lista de jogos (usado nos avisos de quem segue jogos). O Firestore aceita até 30 valores no "in".
export async function listarPromocoesDosJogos(gameIDs) {
  const resultado = [];
  for (let i = 0; i < gameIDs.length; i += 30) {
    const snap = await getDocs(query(colPromocoes, where('gameID', 'in', gameIDs.slice(i, i + 30))));
    snap.docs.forEach((d) => resultado.push({ id: d.id, ...d.data() }));
  }
  return resultado.sort((a, b) => (b.aprovadoEm?.toMillis() ?? 0) - (a.aprovadoEm?.toMillis() ?? 0));
}

// U — Atualizar preço com os dados atuais da API
export async function atualizarPrecoPromocao(id, precos) {
  return updateDoc(doc(db, 'promocoes', id), { ...precos, atualizadoEm: serverTimestamp() });
}

// D — Remover da aplicação (o jogo continua na lista "já esteve em oferta")
export async function removerPromocao(id) {
  return deleteDoc(doc(db, 'promocoes', id));
}

export async function listarJogos() {
  const snap = await getDocs(query(colJogos, orderBy('titulo')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
