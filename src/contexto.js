// Dados das APIs usados em várias telas: cotação do dólar e lista de lojas.
// Carregados uma vez por página e reaproveitados.
import { buscarCotacaoDolar, buscarLojas } from './api.js';
import { formatarReal } from './util.js';

export const contexto = { cotacao: null, atualizadoEm: null, lojas: new Map() };

let carregamento;
export function carregarContexto() {
  carregamento ??= Promise.allSettled([
    buscarCotacaoDolar().then(({ valor, atualizadoEm }) => {
      contexto.cotacao = valor;
      contexto.atualizadoEm = atualizadoEm;
    }),
    buscarLojas().then((lista) => lista.forEach((l) => contexto.lojas.set(l.id, l))),
  ]).then((resultados) => {
    resultados.filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason));
    return contexto;
  });
  return carregamento;
}

// Preço em dólar → texto em reais (ou em dólar se a cotação falhar)
export function precoEmReal(dolar) {
  if (dolar === 0) return 'Grátis';
  return contexto.cotacao ? formatarReal(dolar * contexto.cotacao) : `US$ ${dolar.toFixed(2)}`;
}

export function dolarParaReal(dolar) {
  return contexto.cotacao ? dolar * contexto.cotacao : null;
}

export function nomeDaLoja(id) {
  return contexto.lojas.get(id)?.nome || 'Loja parceira';
}

export function iconeDaLoja(id) {
  return contexto.lojas.get(id)?.icone || '';
}
