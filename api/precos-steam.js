// Função serverless do Vercel: preços REAIS da Steam Brasil (em reais), para vários jogos de uma vez.
// A CheapShark só informa o preço em dólar da loja americana; a Steam tem preço regional no Brasil,
// muitas vezes bem menor que "dólar × cotação". Uso: /api/precos-steam?apps=1091500,620
export default async function handler(req, res) {
  const apps = [...new Set(String(req.query.apps || '').split(',').map((a) => a.replace(/\D/g, '')).filter(Boolean))].slice(0, 100);
  if (!apps.length) return res.status(400).json({ erro: 'Informe ?apps=<ids da Steam separados por vírgula>' });
  try {
    // com filters=price_overview a Steam aceita vários appids na mesma consulta
    const resp = await fetch(`https://store.steampowered.com/api/appdetails?appids=${apps.join(',')}&cc=br&l=portuguese&filters=price_overview`);
    if (!resp.ok) return res.status(502).json({ erro: `Steam respondeu ${resp.status}` });
    const dados = await resp.json();
    const precos = {};
    for (const id of apps) {
      const p = dados?.[id]?.success ? dados[id].data?.price_overview : null;
      if (p && p.currency === 'BRL') {
        precos[id] = { final: p.final / 100, inicial: p.initial / 100, desconto: p.discount_percent || 0 };
      } else if (dados?.[id]?.success && Array.isArray(dados[id].data) ) {
        precos[id] = { final: 0, inicial: 0, desconto: 0, gratis: true }; // jogo grátis: a Steam devolve data: []
      }
    }
    // preços mudam pouco ao longo do dia: 10 min na borda do Vercel
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json(precos);
  } catch {
    return res.status(502).json({ erro: 'Não foi possível consultar a Steam.' });
  }
}
