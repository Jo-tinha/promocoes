// Destaques: promoções escolhidas a dedo pelo admin (coleção "destaques").
// Também mantém "jogos": todo jogo que já foi destaque, para a lista do Notificar.
import { collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, serverTimestamp } from 'firebase/firestore';
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
  const lista = snap.docs.map((d) => {
    const dados = d.data();
    const link = dados.manual ? dados.link : linkDaPromocao(dados.dealID, { lojaId: dados.lojaId, steamAppID: dados.steamAppID });
    return {
      id: d.id,
      ...dados,
      dealID: dados.manual ? `manual-${d.id}` : dados.dealID,
      link,
      ativo: dados.ativo !== false, // destaques antigos não têm o campo: contam como ativos
      exibir: dados.exibir || 'ambos', // 'ambos' | 'banner' | 'faixa'
    };
  });
  // quem tem "ordem" vem primeiro, na ordem escolhida; o resto, do mais novo para o mais antigo
  const semOrdem = 1e9;
  return lista
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.ordem ?? semOrdem) - (b.d.ordem ?? semOrdem) || a.i - b.i)
    .map(({ d }) => d);
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
  const ids = [...new Set(destaques.filter((d) => !d.manual).map((d) => d.gameID).filter(Boolean))];
  const ofertas = ids.length ? await buscarOfertasDosJogos(ids) : []; // só traz o que está em promoção agora
  const porDeal = new Map(ofertas.map((o) => [idPromocao(o.dealID), o]));
  return destaques.map((d) => {
    if (d.manual) return { ...d, emPromocao: manualVigente(d) };
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

// ---------- Destaques manuais (criados no painel, não vêm da API) ----------
// Preços em REAIS (moeda: 'BRL'); preço é opcional (banner de evento, anúncio etc.).
export function manualVigente(d) {
  if (!d.termina) return true;
  const fim = d.termina.toDate ? d.termina.toDate() : new Date(`${d.termina}T23:59:59`);
  return fim >= new Date();
}

function manualParaFirestore(dados) {
  const normal = dados.precoNormal === '' || dados.precoNormal == null ? null : Number(dados.precoNormal);
  const promo = dados.precoPromocional === '' || dados.precoPromocional == null ? null : Number(dados.precoPromocional);
  return {
    manual: true,
    moeda: 'BRL',
    titulo: dados.titulo.trim(),
    imagem: dados.imagem.trim(),
    imagemBanner: dados.imagemBanner.trim(),
    link: dados.link.trim(),
    lojaId: dados.lojaId || '',
    lojaNome: dados.lojaNome.trim(),
    precoNormal: normal,
    precoPromocional: promo,
    desconto: normal && promo !== null && normal > 0 ? Math.max(0, Math.round((1 - promo / normal) * 100)) : 0,
    textoBotao: dados.textoBotao.trim() || 'Ver oferta',
    comentario: dados.comentario.trim().slice(0, 140),
    termina: dados.termina || null, // 'AAAA-MM-DD' ou null
    exibir: dados.exibir || 'ambos',
    ativo: dados.ativo !== false,
  };
}

export function validarManual(dados) {
  const erros = [];
  const url = (t) => /^https?:\/\/\S+$/.test(t.trim());
  if (!dados.titulo.trim()) erros.push('Informe o título.');
  if (!url(dados.imagem)) erros.push('A imagem do cartão precisa ser um link http(s).');
  if (dados.imagemBanner.trim() && !url(dados.imagemBanner)) erros.push('A imagem do banner precisa ser um link http(s).');
  if (!url(dados.link)) erros.push('O link de destino precisa começar com http:// ou https://.');
  const normal = dados.precoNormal === '' ? null : Number(dados.precoNormal);
  const promo = dados.precoPromocional === '' ? null : Number(dados.precoPromocional);
  if (promo !== null && !(promo >= 0)) erros.push('Preço promocional inválido.');
  if (normal !== null && !(normal > 0)) erros.push('Preço normal inválido.');
  if (normal !== null && promo !== null && promo > normal) erros.push('O preço promocional não pode ser maior que o normal.');
  if (normal !== null && promo === null) erros.push('Informe também o preço promocional (ou deixe os dois vazios).');
  return erros;
}

// C
export async function criarDestaqueManual(dados) {
  return addDoc(colDestaques, { ...manualParaFirestore(dados), ordem: -Date.now() / 1e6, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
}

// U
export async function atualizarDestaqueManual(id, dados) {
  return updateDoc(doc(db, 'destaques', id), { ...manualParaFirestore(dados), atualizadoEm: serverTimestamp() });
}

// U — pausar/ativar sem apagar
export async function alternarAtivoDestaque(id, ativo) {
  return updateDoc(doc(db, 'destaques', id), { ativo, atualizadoEm: serverTimestamp() });
}

// U — onde aparece (vale também para destaques da API)
export async function definirExibicaoDestaque(id, exibir) {
  return updateDoc(doc(db, 'destaques', id), { exibir, atualizadoEm: serverTimestamp() });
}

// U — grava a ordem atual (lista de ids, do primeiro ao último)
export async function salvarOrdemDestaques(ids) {
  const lote = writeBatch(db);
  ids.forEach((id, i) => lote.update(doc(db, 'destaques', id), { ordem: i }));
  return lote.commit();
}
