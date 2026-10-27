// Catálogo de recomendações diárias (coleção "recomendacoes"): qualquer jogo, notícia ou evento gamer
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

const colecao = collection(db, 'recomendacoes');

export const TIPOS = { jogo: 'Jogo', noticia: 'Notícia', evento: 'Evento' };

function paraFirestore(d) {
  return {
    tipo: d.tipo,
    titulo: d.titulo.trim(),
    descricao: d.descricao.trim(),
    link: d.link.trim(),
    imagem: d.imagem.trim(),
    data: d.data, // dia em que a recomendação vale, 'AAAA-MM-DD'
  };
}

// C
export async function criarRecomendacao(dados) {
  return addDoc(colecao, { ...paraFirestore(dados), criadoEm: serverTimestamp() });
}

// R — as mais recentes primeiro
export async function listarRecomendacoes(max = 60) {
  const snap = await getDocs(query(colecao, orderBy('data', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// U
export async function atualizarRecomendacao(id, dados) {
  return updateDoc(doc(db, 'recomendacoes', id), paraFirestore(dados));
}

// D
export async function excluirRecomendacao(id) {
  return deleteDoc(doc(db, 'recomendacoes', id));
}

export function validarRecomendacao(d) {
  const erros = [];
  if (!TIPOS[d.tipo]) erros.push('Escolha o tipo.');
  if (!d.titulo.trim()) erros.push('Informe o título.');
  if (!/^https?:\/\/\S+$/.test(d.link.trim())) erros.push('O link deve começar com http:// ou https://.');
  if (d.imagem.trim() && !/^https?:\/\/\S+$/.test(d.imagem.trim())) erros.push('A imagem deve ser um link http(s).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) erros.push('Informe a data.');
  return erros;
}
