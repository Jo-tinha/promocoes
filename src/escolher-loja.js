// Tela "Escolha a loja": quando um jogo está em promoção em várias lojas, mostra cada loja com o seu preço
import { buscarOfertasDoJogo } from './api.js';
import { contexto, carregarContexto, precoEmReal } from './contexto.js';
import { varsDaLoja, imgJogo } from './lojas.js';
import { botaoEstrela } from './estrela.js';
import { esc, idPromocao } from './util.js';

let dialogo;

function montarDialogo() {
  dialogo = document.createElement('dialog');
  dialogo.className = 'escolha';
  dialogo.setAttribute('aria-labelledby', 'escolha-titulo');
  document.body.append(dialogo);
  // clicar fora do conteúdo ou no × fecha
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('[data-fechar]')) fechar();
  });
  dialogo.addEventListener('close', () => document.body.classList.remove('escolha-aberta'));
}

function fechar() {
  dialogo?.close();
}

function linhaOferta(o, { destacadas, menor }) {
  const loja = contexto.lojas.get(o.lojaId);
  const ehMenor = o.precoPromocional === menor;
  return `
    <a class="escolha-linha${ehMenor ? ' menor' : ''}" href="${esc(o.link)}" target="_blank" rel="noopener sponsored" style="${varsDaLoja(o.lojaId)}">
      <span class="escolha-loja">
        ${loja ? `<img src="${esc(loja.icone)}" alt="" />` : ''}
        <span>
          <strong>${esc(loja?.nome || 'Loja')}</strong>
          <small>${[ehMenor ? 'Menor preço' : '', destacadas.has(idPromocao(o.dealID)) ? '★ Destaque' : ''].filter(Boolean).join(' · ')}</small>
        </span>
      </span>
      <span class="escolha-preco">
        ${o.desconto >= 1 ? `<span class="desconto">-${o.desconto}%</span>` : ''}
        ${o.desconto >= 1 ? `<span class="preco-antigo">${precoEmReal(o.precoNormal)}</span>` : ''}
        <strong>${o.precoPromocional === 0 ? 'Grátis' : precoEmReal(o.precoPromocional)}</strong>
      </span>
      <span class="escolha-ir" aria-hidden="true">Ir →</span>
    </a>`;
}

function renderizar(jogo, ofertas, { destacadas, historico, carregando = false, erro = false }) {
  const precosEmPromo = ofertas.map((o) => o.precoPromocional);
  const menor = Math.min(...precosEmPromo);
  const maior = Math.max(...precosEmPromo);
  const media = precosEmPromo.reduce((s, v) => s + v, 0) / (precosEmPromo.length || 1);
  dialogo.innerHTML = `
    <div class="escolha-conteudo">
      <div class="escolha-capa">
        ${imgJogo(jogo, 'banner', '')}
        <button class="escolha-fechar" type="button" data-fechar aria-label="Fechar">×</button>
      </div>
      <div class="escolha-corpo">
        <h2 id="escolha-titulo">${esc(jogo.titulo)}</h2>
        <p class="escolha-resumo">
          ${ofertas.length} ${ofertas.length === 1 ? 'loja' : 'lojas'} ·
          média <strong>${precoEmReal(media)}</strong>
          ${ofertas.length > 1 ? `· de ${precoEmReal(menor)} a ${precoEmReal(maior)}` : ''}
        </p>
        ${historico ? `<p class="escolha-historico">Menor preço já registrado: <strong>${precoEmReal(historico.preco)}</strong> em ${historico.data.toLocaleDateString('pt-BR')}</p>` : ''}
        <h3 class="escolha-subtitulo">Escolha a loja ${carregando ? '<span class="busca-carregando" style="position:static;display:inline-block;vertical-align:middle"></span>' : ''}</h3>
        <div class="escolha-lista">
          ${ofertas.map((o) => linhaOferta(o, { destacadas, menor })).join('')}
        </div>
        ${erro ? '<p class="secao-nota">Não foi possível atualizar os preços agora; mostrando os preços dos destaques.</p>' : ''}
        <div class="escolha-rodape">
          ${botaoEstrela(jogo, { grande: true })}
          <span class="secao-nota">Preços convertidos pela cotação do dia; o valor final é o da loja.</span>
        </div>
      </div>
    </div>`;
}

// jogo: { gameID, titulo, imagem, steamAppID, ofertas: [...] } — ofertas já conhecidas (dos destaques)
export async function abrirEscolha(jogo) {
  if (!dialogo) montarDialogo();
  const destacadas = new Set(jogo.ofertas.map((o) => idPromocao(o.dealID)));
  const conhecidas = [...jogo.ofertas].sort((a, b) => a.precoPromocional - b.precoPromocional);
  await carregarContexto();
  renderizar(jogo, conhecidas, { destacadas, carregando: true });
  document.body.classList.add('escolha-aberta');
  if (!dialogo.open) dialogo.showModal();

  if (!jogo.gameID) return renderizar(jogo, conhecidas, { destacadas });
  try {
    // preços atuais de todas as lojas onde o jogo está à venda
    // o mesmo jogo pode ter mais de um ID na CheapShark (um por loja): consulta todos e junta
    const ids = [...new Set([jogo.gameID, ...jogo.ofertas.map((o) => o.gameID)].filter(Boolean))];
    const respostas = await Promise.all(ids.map((id) => buscarOfertasDoJogo(id)));
    const atual = respostas[0];
    const vistas = new Map();
    for (const o of respostas.flatMap((r) => r.ofertas)) vistas.set(idPromocao(o.dealID), o);
    for (const o of conhecidas) if (!vistas.has(idPromocao(o.dealID))) vistas.set(idPromocao(o.dealID), o);
    const todas = [...vistas.values()];
    // uma linha por loja (a mais barata)
    const porLoja = new Map();
    for (const o of todas) if (!porLoja.has(o.lojaId) || o.precoPromocional < porLoja.get(o.lojaId).precoPromocional) porLoja.set(o.lojaId, o);
    const unicas = [...porLoja.values()].sort((a, b) => a.precoPromocional - b.precoPromocional);
    const emPromocao = unicas.filter((o) => o.precoPromocional < o.precoNormal || destacadas.has(idPromocao(o.dealID)));
    const lista = emPromocao.length ? emPromocao : unicas;
    if (dialogo.open) renderizar({ ...jogo, steamAppID: jogo.steamAppID || atual.steamAppID }, lista, { destacadas, historico: atual.menorPrecoHistorico });
  } catch (erro) {
    console.error(erro);
    if (dialogo.open) renderizar(jogo, conhecidas, { destacadas, erro: true });
  }
}
