// CRUD das recomendações (promoções da CheapShark escolhidas pelo admin) na coleção "recomendacoes"
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const colecao = collection(db, 'recomendacoes');

// C — Cadastrar (a partir de uma promoção da CheapShark). Evita recomendar a mesma promoção duas vezes.
export async function recomendar(promo, comentario = '') {
  const existente = await getDocs(query(colecao, where('dealID', '==', promo.id), limit(1)));
  if (!existente.empty) return { duplicada: true };
  await addDoc(colecao, {
    dealID: promo.id,
    titulo: promo.titulo,
    lojaId: promo.lojaId,
    precoNormal: promo.precoNormal, // em dólar, no momento da recomendação
    precoPromocional: promo.precoPromocional,
    desconto: promo.desconto,
    imagem: promo.imagem,
    link: promo.link,
    comentario: comentario.trim(),
    criadoEm: serverTimestamp(),
  });
  return { duplicada: false };
}

// R — Consultar
export async function listarRecomendacoes() {
  const snap = await getDocs(query(colecao, orderBy('criadoEm', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// U — Atualizar
export async function atualizarComentario(id, comentario) {
  return updateDoc(doc(db, 'recomendacoes', id), { comentario: comentario.trim() });
}

// D — Excluir
export async function excluirRecomendacao(id) {
  return deleteDoc(doc(db, 'recomendacoes', id));
}
