// Função serverless do Vercel: descobre o trailer curto ("microtrailer") de um jogo na Steam.
// O navegador não pode consultar a Steam direto (CORS); por isso passa por aqui. Uso: /api/trailer?app=1091500
// A Steam hoje entrega os trailers em streaming (HLS/DASH) e, na mesma pasta, um microtrailer curto
// e sem som em .mp4 e .webm — ideal para tocar quando o mouse passa por cima do cartão.
export default async function handler(req, res) {
  const app = String(req.query.app || '').replace(/\D/g, '').slice(0, 10);
  if (!app) return res.status(400).json({ erro: 'Informe ?app=<id do jogo na Steam>' });
  try {
    const resp = await fetch(`https://store.steampowered.com/api/appdetails?appids=${app}&filters=movies`, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    });
    if (!resp.ok) return res.status(502).json({ erro: `Steam respondeu ${resp.status}` });
    const dados = await resp.json();
    const filmes = dados?.[app]?.data?.movies || [];
    const filme = filmes.find((f) => f.highlight) || filmes[0];
    const fontes = [];
    if (filme) {
      // formato atual: .../store_trailers/<app>/<id>/<hash>/<versão>/hls_264_master.m3u8
      const stream = String(filme.hls_h264 || filme.dash_h264 || filme.dash_av1 || '').split('?')[0];
      if (stream) {
        const pasta = stream.slice(0, stream.lastIndexOf('/') + 1);
        fontes.push({ url: `${pasta}microtrailer.mp4`, tipo: 'video/mp4' }, { url: `${pasta}microtrailer.webm`, tipo: 'video/webm' });
      }
      // formato antigo: arquivos diretos
      if (filme.mp4) fontes.push({ url: filme.mp4['480'] || filme.mp4.max, tipo: 'video/mp4' });
      if (filme.webm) fontes.push({ url: filme.webm['480'] || filme.webm.max, tipo: 'video/webm' });
      if (!stream && filme.id) {
        fontes.push({ url: `https://cdn.akamai.steamstatic.com/steam/apps/${filme.id}/microtrailer.webm`, tipo: 'video/webm' });
      }
    }
    // a lista de trailers muda pouco: guarda 1 dia na borda do Vercel
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ fontes: fontes.filter((f) => f.url), capa: filme?.thumbnail || null });
  } catch {
    return res.status(502).json({ erro: 'Não foi possível consultar a Steam.' });
  }
}
