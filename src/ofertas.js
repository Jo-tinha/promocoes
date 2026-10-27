// CRUD das ofertas oficiais na coleção "ofertas" do Firestore
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const colecao = collection(db, 'ofertas');

// Converte os dados do formulário para o formato salvo no banco
function paraFirestore(dados) {
  return {
    titulo: dados.titulo.trim(),
    descricao: dados.descricao.trim(),
    categoria: dados.categoria.trim().toLowerCase(),
    precoOriginal: Number(dados.precoOriginal),
    precoOferta: Number(dados.precoOferta),
    imagemUrl: dados.imagemUrl.trim(),
    validoAte: dados.validoAte ? Timestamp.fromDate(new Date(`${dados.validoAte}T23:59:59`)) : null,
    ativa: Boolean(dados.ativa),
  };
}

// C — Cadastrar
export async function cadastrarOferta(dados) {
  return addDoc(colecao, { ...paraFirestore(dados), criadoEm: serverTimestamp() });
}

// R — Consultar
export async function listarOfertas() {
  const snap = await getDocs(query(colecao, orderBy('criadoEm', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// U — Atualizar
export async function atualizarOferta(id, dados) {
  return updateDoc(doc(db, 'ofertas', id), paraFirestore(dados));
}

export async function alternarAtiva(id, ativa) {
  return updateDoc(doc(db, 'ofertas', id), { ativa });
}

// D — Excluir
export async function excluirOferta(id) {
  return deleteDoc(doc(db, 'ofertas', id));
}

// Validação usada antes de gravar; devolve uma lista de erros (vazia se estiver tudo certo)
export function validarOferta(dados) {
  const erros = [];
  const original = Number(dados.precoOriginal);
  const oferta = Number(dados.precoOferta);
  if (!dados.titulo.trim()) erros.push('Informe o título.');
  if (!dados.categoria.trim()) erros.push('Informe a categoria.');
  if (!(original > 0)) erros.push('O preço original deve ser maior que zero.');
  if (!(oferta > 0)) erros.push('O preço da oferta deve ser maior que zero.');
  if (oferta >= original) erros.push('O preço da oferta deve ser menor que o preço original.');
  if (dados.imagemUrl.trim() && !/^https?:\/\//.test(dados.imagemUrl.trim())) {
    erros.push('A imagem deve ser um link começando com http:// ou https://.');
  }
  return erros;
}

export function ofertaVigente(oferta) {
  if (!oferta.ativa) return false;
  if (!oferta.validoAte) return true;
  return oferta.validoAte.toDate() >= new Date();
}
