// Destaques: promoções escolhidas a dedo pelo admin (coleção "destaques").
// Também mantém "jogos": todo jogo que já foi destaque, para a lista do Notificar.
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { buscarOfertasDosJogos, linkDaPromocao } from './api.js';
import { idPromocao } from './util.js';

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
    steamAppID: p.steamAppID || null,
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
      {
        gameID: p.gameID,
        titulo: p.titulo,
        imagem: p.imagem || '',
        steamAppID: String(p.steamAppID || ''),
        lojaId: p.lojaId || '',
        ultimoPreco: p.precoPromocional,
        ultimoPrecoNormal: p.precoNormal,
        ultimoDesconto: p.desconto,
        ultimaPromocaoEm: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

// R
export async function listarDestaques() {
  const snap = await getDocs(query(colDestaques, orderBy('criadoEm', 'desc')));
  // o link é refeito a partir do ID (destaques antigos podiam ter o ID codificado duas vezes)
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), link: linkDaPromocao(d.data().dealID) }));
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

// Confere na CheapShark, de uma vez, a situação atual de cada destaque.
// Devolve os destaques com preço e desconto de agora e o campo "emPromocao" (false = a promoção acabou).
// Destaques sem gameID ficam como estão.
export async function conferirDestaquesAoVivo(destaques) {
  const ids = [...new Set(destaques.map((d) => d.gameID).filter(Boolean))];
  if (!ids.length) return destaques.map((d) => ({ ...d, emPromocao: d.precoPromocional < d.precoNormal }));
  const ofertas = await buscarOfertasDosJogos(ids); // só traz o que está em promoção agora
  const porDeal = new Map(ofertas.map((o) => [idPromocao(o.dealID), o]));
  return destaques.map((d) => {
    if (!d.gameID) return { ...d, emPromocao: d.precoPromocional < d.precoNormal };
    const agora = porDeal.get(idPromocao(d.dealID));
    if (!agora) return { ...d, emPromocao: false };
    return {
      ...d,
      precoNormal: agora.precoNormal,
      precoPromocional: agora.precoPromocional,
      desconto: agora.desconto,
      emPromocao: true,
      precoMudou: Math.abs(agora.precoPromocional - d.precoPromocional) > 0.009,
    };
  });
}

// U — comentário do admin
export async function editarComentarioDestaque(id, comentario) {
  return atualizarDestaque(id, { comentario: comentario.trim().slice(0, 140) });
}
