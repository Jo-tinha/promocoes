// CRUD do catálogo "notificar": alertas de jogos que o admin quer vigiar.
// Na inspeção diária, cada alerta guarda os IDs das promoções já vistas para destacar só as novas.
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
} from 'firebase/firestore';
import { db } from './firebase.js';

const colecao = collection(db, 'notificar');
const MAX_VISTOS = 300; // limita o tamanho do documento

function paraFirestore(dados) {
  return {
    termo: dados.termo.trim(),
    precoMaximo: dados.precoMaximo ? Number(dados.precoMaximo) : null, // em reais
    lojaId: dados.lojaId || '',
    ativo: Boolean(dados.ativo),
  };
}

// C — Cadastrar
export async function criarAlerta(dados) {
  return addDoc(colecao, { ...paraFirestore(dados), vistos: [], ultimaInspecao: null, criadoEm: serverTimestamp() });
}

// R — Consultar
export async function listarAlertas() {
  const snap = await getDocs(query(colecao, orderBy('criadoEm', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, vistos: [], ...d.data() }));
}

// U — Atualizar
export async function atualizarAlerta(id, dados) {
  return updateDoc(doc(db, 'notificar', id), paraFirestore(dados));
}

export async function alternarAlerta(id, ativo) {
  return updateDoc(doc(db, 'notificar', id), { ativo });
}

// Inspeção diária: marca as promoções atuais como vistas e registra a data
export async function registrarInspecao(alerta, idsAtuais) {
  const vistos = [...new Set([...(alerta.vistos || []), ...idsAtuais])].slice(-MAX_VISTOS);
  return updateDoc(doc(db, 'notificar', alerta.id), { vistos, ultimaInspecao: serverTimestamp() });
}

// D — Excluir
export async function excluirAlerta(id) {
  return deleteDoc(doc(db, 'notificar', id));
}

export function validarAlerta(dados) {
  const erros = [];
  if (dados.termo.trim().length < 2) erros.push('Informe o nome do jogo (pelo menos 2 letras).');
  if (dados.precoMaximo && !(Number(dados.precoMaximo) > 0)) erros.push('O preço máximo deve ser maior que zero.');
  return erros;
}

export function inspecionadoHoje(alerta) {
  if (!alerta.ultimaInspecao) return false;
  return alerta.ultimaInspecao.toDate().toDateString() === new Date().toDateString();
}
