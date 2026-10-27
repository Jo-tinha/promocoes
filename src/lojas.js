// Identidade visual de cada loja (IDs da CheapShark) e ordem em que aparecem na vitrine
export const ESTILO_LOJAS = {
  1: { cor: '#66c0f4', fundo: '#1b2838' }, // Steam
  25: { cor: '#2f8cff', fundo: '#121212' }, // Epic Games Store
  7: { cor: '#b14bd8', fundo: '#2a0e33' }, // GOG
  11: { cor: '#ff4a4a', fundo: '#2b0d0d' }, // Humble Store
  15: { cor: '#ff9a1f', fundo: '#2b1a05' }, // Fanatical
  3: { cor: '#20e070', fundo: '#062615' }, // Green Man Gaming
  13: { cor: '#3aa0ff', fundo: '#071a33' }, // Ubisoft
  8: { cor: '#ff5a4f', fundo: '#2a0f0d' }, // EA
  27: { cor: '#00b2ff', fundo: '#03202e' }, // Gamesplanet
  2: { cor: '#3fa9f5', fundo: '#0b1d2e' }, // GamersGate
  31: { cor: '#00aeff', fundo: '#04192a' }, // Blizzard
  30: { cor: '#ff5a5f', fundo: '#2b0f10' }, // IndieGala
  29: { cor: '#ff2d6f', fundo: '#2b0816' }, // 2Game
  23: { cor: '#f9b233', fundo: '#2b1f06' }, // GameBillet
  24: { cor: '#ff3d9a', fundo: '#2b0a1b' }, // Voidu
  21: { cor: '#3ddc84', fundo: '#0a2617' }, // WinGameStore
  33: { cor: '#f5a623', fundo: '#2b1d06' }, // DLGamer
  34: { cor: '#a66bff', fundo: '#1c0f33' }, // Noctre
  35: { cor: '#ff7a1a', fundo: '#2b1404' }, // DreamGame
  28: { cor: '#ff3b3b', fundo: '#2b0a0a' }, // Gamesload
};

const PADRAO = { cor: '#ff5c35', fundo: '#1e2330' };

export const ORDEM_LOJAS = ['1', '25', '7', '11', '15', '3', '13', '8', '27', '2', '31', '30', '29', '23', '24', '21', '33', '34', '35', '28'];

export function estiloDaLoja(id) {
  return ESTILO_LOJAS[id] || PADRAO;
}

// Variáveis CSS para pintar um elemento com as cores da loja
export function varsDaLoja(id) {
  const { cor, fundo } = estiloDaLoja(id);
  return `--cor-loja:${cor};--fundo-loja:${fundo}`;
}

// Brindes da GamerPower informam a plataforma em texto ("PC, Epic Games Store") → loja da CheapShark
export function lojaPelaPlataforma(texto = '') {
  const t = texto.toLowerCase();
  if (t.includes('epic')) return '25';
  if (t.includes('gog')) return '7';
  if (t.includes('steam')) return '1';
  if (t.includes('ubisoft')) return '13';
  if (t.includes('humble')) return '11';
  return '';
}

// Capas da Steam vêm pequenas na CheapShark; a versão "header" tem 460×215
export function imagemGrande(url = '') {
  return url.replace(/capsule_sm_120\.jpg/, 'header.jpg');
}
