// Aba "Recomendações": consultar, editar o comentário e excluir as recomendações publicadas
import { listarRecomendacoes, atualizarComentario, excluirRecomendacao } from './recomendacoes.js';
import { precoEmReal, nomeDaLoja } from './contexto.js';
import { esc, IMAGEM_PADRAO } from './util.js';

const lista = document.querySelector('#lista-recomendacoes');
const contagem = document.querySelector('#contagem-recomendacoes');

let recomendacoes = [];

function linha(r) {
  return `
    <tr>
      <td><img class="miniatura larga" src="${esc(r.imagem)}" alt="" onerror="this.src='${IMAGEM_PADRAO}'" /></td>
      <td><strong>${esc(r.titulo)}</strong><br /><span class="secao-nota">${esc(nomeDaLoja(r.lojaId))} · -${r.desconto}%</span></td>
      <td><span class="preco-antigo">${precoEmReal(r.precoNormal)}</span><br />${precoEmReal(r.precoPromocional)}</td>
      <td class="comentario">${r.comentario ? esc(r.comentario) : '<span class="secao-nota">sem comentário</span>'}</td>
      <td>
        <div class="acoes-linha">
          <a class="botao secundario pequeno" href="${esc(r.link)}" target="_blank" rel="noopener">Abrir</a>
          <button class="botao secundario pequeno" data-acao="comentar" data-id="${r.id}">Editar comentário</button>
          <button class="botao perigo pequeno" data-acao="excluir" data-id="${r.id}">Excluir</button>
        </div>
      </td>
    </tr>`;
}

export async function carregarRecomendacoes() {
  try {
    recomendacoes = await listarRecomendacoes();
    contagem.textContent = `${recomendacoes.length} ${recomendacoes.length === 1 ? 'recomendação' : 'recomendações'}`;
    lista.innerHTML = recomendacoes.length
      ? recomendacoes.map(linha).join('')
      : '<tr><td colspan="5">Nenhuma recomendação ainda.</td></tr>';
  } catch (erro) {
    console.error(erro);
    lista.innerHTML = '<tr><td colspan="5" class="mensagem erro">Erro ao carregar as recomendações.</td></tr>';
  }
}

export function iniciarRecomendacoes() {
  lista.addEventListener('click', async (e) => {
    const botao = e.target.closest('button[data-acao]');
    if (!botao) return;
    const rec = recomendacoes.find((r) => r.id === botao.dataset.id);
    if (!rec) return;
    try {
      if (botao.dataset.acao === 'comentar') {
        const novo = prompt('Por que você recomenda essa promoção?', rec.comentario || '');
        if (novo === null) return;
        await atualizarComentario(rec.id, novo.slice(0, 200));
      } else if (botao.dataset.acao === 'excluir') {
        if (!confirm(`Remover "${rec.titulo}" das recomendações?`)) return;
        await excluirRecomendacao(rec.id);
      }
      await carregarRecomendacoes();
    } catch (erro) {
      console.error(erro);
      alert('Não foi possível concluir a ação. Tente novamente.');
    }
  });
}
