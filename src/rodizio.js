// Rodízio de destaques: todo destaque que completa 24 horas no ar dá lugar a uma promoção nova,
// escolhida entre as melhores do momento na CheapShark. Vale igual para os escolhidos pelo admin
// e para os que entraram pelo rodízio (não há diferença entre eles); só os marcados como "Fixo" ficam.
//
// - Na vitrine, a troca aparece na hora para todo mundo (só na tela, sem gravar).
// - No painel do admin, a troca é gravada no Firestore (o site não tem servidor próprio, e só o admin
//   pode escrever nos destaques).
import { buscarPromocoes } from './api.js';
import { nomeNormalizado } from './cartoes.js';
import { destacar, removerDestaque, jaDestacados, lembrarDestacados, lerConfigRodizio, salvarMetricaRodizio } from './destaques.js';

export const DURACAO_DESTAQUE = 24 * 60 * 60 * 1000;

export const venceu = (d, agora = Date.now()) => d.ativo !== false && !d.fixo && agora - (d.noArMs ?? agora) >= DURACAO_DESTAQUE;

export function tempoRestante(d, agora = Date.now()) {
  return Math.max(0, DURACAO_DESTAQUE - (agora - (d.noArMs ?? agora)));
}

// Métricas de qualidade para escolher destaques sozinho (de propósito, nada de "mais recentes")
export const METRICAS = {
  custo: { rotulo: '💰 Melhor custo-benefício', busca: { ordem: 'Deal Rating', steamMin: 75 } },
  aclamados: { rotulo: '🏆 Mais aclamados (Metacritic)', busca: { ordem: 'Metacritic', metacriticMin: 75 } },
  steam: { rotulo: '👍 Mais bem avaliados na Steam', busca: { ordem: 'Reviews', steamMin: 85 } },
  descontos: { rotulo: '💥 Maiores descontos (com nota boa)', busca: { ordem: 'Savings', steamMin: 80 } },
  aaa: { rotulo: '🎮 AAA com melhor custo-benefício', busca: { ordem: 'Deal Rating', aaa: true } },
};
export const METRICA_PADRAO = 'custo';

const candidatosCache = new Map(); // métrica|loja → { em, lista }
async function candidatos(metrica = METRICA_PADRAO, lojaId = '') {
  const chave = `${metrica}|${lojaId}`;
  const salvo = candidatosCache.get(chave);
  if (!salvo || Date.now() - salvo.em > 10 * 60 * 1000) {
    const { busca } = METRICAS[metrica] || METRICAS[METRICA_PADRAO];
    const lista = await buscarPromocoes({ ...busca, lojaId, limite: 60 });
    // com arte da Steam (para o banner ficar bonito) e que não seja grátis (os grátis têm faixa própria)
    candidatosCache.set(chave, { em: Date.now(), lista: lista.filter((p) => p.steamAppID && p.precoPromocional > 0) });
  }
  return candidatosCache.get(chave).lista;
}

// Escolhe "quantos" jogos novos, sem repetir os que já estão nos destaques nem os destacados há pouco
function escolher(opcoes, quantos, { destaques, recentes }) {
  const usados = new Set([...recentes, ...destaques.map((d) => d.gameID)].filter(Boolean).map(String));
  const titulos = new Set(destaques.map((d) => nomeNormalizado(d.titulo)));
  const escolhidos = [];
  for (const p of opcoes) {
    if (escolhidos.length >= quantos) break;
    if (usados.has(String(p.gameID)) || titulos.has(nomeNormalizado(p.titulo))) continue;
    usados.add(String(p.gameID));
    titulos.add(nomeNormalizado(p.titulo));
    escolhidos.push(p);
  }
  return escolhidos;
}

// Devolve a lista com os vencidos trocados e a lista de trocas [{ saiu, entrou }]
export async function aplicarRodizio(destaques) {
  const vencidos = destaques.filter((d) => venceu(d));
  if (!vencidos.length) return { lista: destaques, trocas: [] };
  const config = await lerConfigRodizio();
  const opcoes = await candidatos(config.metrica || METRICA_PADRAO);
  const novos = escolher(opcoes, vencidos.length, { destaques, recentes: config.jogos || [] });
  const trocas = [];
  const lista = destaques.map((d) => {
    if (!venceu(d) || !novos.length) return d; // sem promoção nova para pôr no lugar: continua no ar
    const novo = novos.shift();
    const entrou = {
      ...novo,
      id: novo.dealID.replaceAll('/', '_'),
      comentario: '',
      video: '',
      fixo: false,
      ativo: true,
      exibir: d.exibir,
      ordem: d.ordem,
      noArMs: Date.now(),
    };
    trocas.push({ saiu: d, entrou });
    return entrou;
  });
  return { lista, trocas };
}

// "Adicionar automaticamente" (painel): os N melhores pela métrica entram no topo da lista.
// A métrica escolhida também passa a valer para o rodízio de 24 h.
export async function adicionarAutomaticamente(destaques, { metrica = METRICA_PADRAO, quantidade = 3, lojaId = '' } = {}) {
  const [opcoes, recentes] = await Promise.all([candidatos(metrica, lojaId), jaDestacados()]);
  const novos = escolher(opcoes, quantidade, { destaques, recentes: [] });
  // prefere jogos que não foram destaque há pouco; se faltar, completa com os demais
  const frescos = novos.filter((p) => !recentes.includes(String(p.gameID)));
  const lista = [...frescos, ...novos.filter((p) => !frescos.includes(p))].slice(0, quantidade);
  // entram no topo da lista, na ordem da métrica (o melhor primeiro)
  const topo = Math.min(0, ...destaques.map((d) => d.ordem ?? 0));
  for (const [i, p] of lista.entries()) {
    await destacar(p, { ordem: topo - lista.length + i });
  }
  await salvarMetricaRodizio(metrica);
  return lista;
}

// Painel do admin: grava as trocas (o novo entra na mesma posição e no mesmo lugar do que saiu)
export async function executarRodizio(destaques) {
  const { trocas } = await aplicarRodizio(destaques);
  for (const { saiu, entrou } of trocas) {
    await destacar(entrou, { exibir: entrou.exibir, ordem: entrou.ordem });
    await removerDestaque(saiu.id);
  }
  if (trocas.length) await lembrarDestacados(trocas.map((t) => t.saiu.gameID));
  return trocas;
}
