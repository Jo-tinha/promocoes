// Função serverless do Vercel: busca os jogos grátis da GamerPower do lado do servidor,
// evitando bloqueio de CORS no navegador. Disponível em /api/gratis depois do deploy.
export default async function handler(req, res) {
  try {
    const resp = await fetch('https://www.gamerpower.com/api/giveaways?platform=pc&type=game&sort-by=date');
    if (resp.status === 201) {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).json([]); // 201 = nenhum brinde ativo no momento
    }
    if (!resp.ok) return res.status(502).json({ erro: `GamerPower respondeu ${resp.status}` });
    const dados = await resp.json();
    // cache de 30 min na borda do Vercel para respeitar o limite da API
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(dados);
  } catch (erro) {
    return res.status(502).json({ erro: 'Não foi possível consultar a GamerPower.' });
  }
}
