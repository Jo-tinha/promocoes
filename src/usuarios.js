// Perfil do usuário, papel de admin e jogos seguidos (Notificar)
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { listarPromocoesDosJogos } from './promocoes.js';

// Admin = existe um documento admins/{uid}, criado à mão no console do Firebase
export async function ehAdmin(uid) {
  try {
    return (await getDoc(doc(db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

export async function criarPerfil(uid, { nome, email }) {
  // merge: num novo login com Google, atualiza nome/e-mail sem apagar a data dos avisos lidos
  return setDoc(doc(db, 'usuarios', uid), { nome, email, atualizadoEm: serverTimestamp() }, { merge: true });
}

export async function lerPerfil(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? snap.data() : {};
}

// ---------- Notificar: CRUD da subcoleção usuarios/{uid}/seguindo ----------
const colSeguindo = (uid) => collection(db, 'usuarios', uid, 'seguindo');

// C
export async function seguirJogo(uid, jogo) {
  return setDoc(doc(colSeguindo(uid), jogo.gameID), {
    gameID: jogo.gameID,
    titulo: jogo.titulo,
    imagem: jogo.imagem || '',
    precoAlvo: null,
    criadoEm: serverTimestamp(),
  });
}

// R
export async function listarSeguindo(uid) {
  const snap = await getDocs(query(colSeguindo(uid), orderBy('titulo')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// U — avisar só quando o preço ficar até este valor (R$); null = qualquer preço
export async function definirPrecoAlvo(uid, gameID, precoAlvo) {
  return updateDoc(doc(colSeguindo(uid), gameID), { precoAlvo });
}

// D
export async function deixarDeSeguir(uid, gameID) {
  return deleteDoc(doc(colSeguindo(uid), gameID));
}

// ---------- Avisos: promoções aprovadas dos jogos seguidos ----------
// precoEmReais: função que converte dólar → reais (ou null se a cotação falhou)
export async function buscarAvisos(uid, precoEmReais) {
  const [seguindo, perfil] = await Promise.all([listarSeguindo(uid), lerPerfil(uid)]);
  if (!seguindo.length) return { avisos: [], novos: 0 };
  const alvo = new Map(seguindo.map((s) => [s.gameID, s.precoAlvo]));
  const lidosEm = perfil.avisosLidosEm?.toMillis() ?? 0;
  const avisos = (await listarPromocoesDosJogos([...alvo.keys()]))
    .filter((p) => {
      const limite = alvo.get(p.gameID);
      const real = precoEmReais(p.precoPromocional);
      return !limite || real === null || real <= limite;
    })
    .map((p) => ({ ...p, novo: (p.aprovadoEm?.toMillis() ?? 0) > lidosEm }));
  return { avisos, novos: avisos.filter((a) => a.novo).length };
}

export async function marcarAvisosComoLidos(uid) {
  return setDoc(doc(db, 'usuarios', uid), { avisosLidosEm: serverTimestamp() }, { merge: true });
}
