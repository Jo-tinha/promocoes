// Atalhos de busca (Explorar e a busca do painel do admin)
export const ATALHOS = [
  { id: 'aclamados', rotulo: '🏆 Mais aclamados', titulo: 'Mais aclamados', filtros: { ordem: 'Metacritic', mc: '75' } },
  { id: 'steam', rotulo: '👍 Mais bem avaliados', titulo: 'Mais bem avaliados na Steam', filtros: { ordem: 'Reviews', steam: '85' } },
  { id: 'lancamentos', rotulo: '🆕 Lançamentos', titulo: 'Lançamentos em promoção', filtros: { ordem: 'Release' } },
  { id: 'descontos', rotulo: '💥 Maiores descontos', titulo: 'Maiores descontos', filtros: { ordem: 'Savings', desc: '75' } },
  { id: 'aaa', rotulo: '🎮 AAA em promoção', titulo: 'Jogos AAA em promoção', filtros: { aaa: true, ordem: 'Deal Rating' } },
  { id: 'baratos', rotulo: '🪙 Até R$ 20', titulo: 'Até R$ 20', filtros: { max: '20', ordem: 'Metacritic' } },
  { id: 'agora', rotulo: '⏱️ Entraram agora', titulo: 'Entraram em promoção agora', filtros: { ordem: 'Recent' } },
  { id: 'gratis', rotulo: '🎁 Grátis', titulo: 'Grátis agora', filtros: { gratis: true, ordem: 'Recent' } },
];
