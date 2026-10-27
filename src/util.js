const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarReal = (valor) => brl.format(valor);

export function percentualDesconto(original, oferta) {
  return Math.round((1 - oferta / original) * 100);
}

// Evita que textos digitados no cadastro virem HTML na página
export function esc(texto = '') {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatarData(data) {
  if (!data) return 'sem prazo';
  return data.toLocaleDateString('pt-BR');
}

export const IMAGEM_PADRAO =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 4 3%27%3E%3Crect width=%274%27 height=%273%27 fill=%27%23e9e4da%27/%3E%3C/svg%3E';
