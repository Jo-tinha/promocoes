// Aba "＋ Adicionar": destaques criados à mão (jogos, eventos ou anúncios que não vêm da API),
// com pré-visualização ao vivo do cartão e do banner
import { criarDestaqueManual, atualizarDestaqueManual, validarManual } from './destaques.js';
import { contexto, carregarContexto } from './contexto.js';
import { cartaoJogo, pilulaLoja, precos } from './cartoes.js';
import { imgJogo } from './lojas.js';
import { esc } from './util.js';
import { campoImagem, ativarCamposImagem, imagemComErro } from './imagem-ideal.js';
import { renderizarComentario, editorComentario, ativarEditores } from './texto-rico.js';

const form = document.querySelector('#form-manual');
const titulo = document.querySelector('#titulo-form-manual');
const msg = document.querySelector('#msg-manual');
const botaoSalvar = document.querySelector('#salvar-manual');
const botaoCancelar = document.querySelector('#cancelar-manual');
const selectLoja = document.querySelector('#manual-loja');
const campoLojaNome = document.querySelector('#campo-loja-nome');
const previaCartao = document.querySelector('#previa-cartao');
const previaBanner = document.querySelector('#previa-banner');

// campos de imagem com a resolução ideal, prévia do recorte e conferência da imagem
document.querySelector('#campos-imagem-manual').innerHTML =
  campoImagem({ nome: 'imagem', tipo: 'cartao', obrigatorio: true }) + campoImagem({ nome: 'imagemBanner', tipo: 'banner' });
document.querySelector('#editor-comentario-manual').innerHTML = editorComentario({ nome: 'comentario', placeholder: 'Aparece no cartão e no banner' });
const atualizarCamposImagem = () => {
  form.querySelectorAll('[data-campo-imagem]').forEach((c) => c.atualizarImagem?.());
  form.querySelectorAll('[data-editor]').forEach((e) => e.atualizarEditor?.());
};

let editandoId = null;
let aoSalvar = () => {};

const CAMPOS = ['titulo', 'imagem', 'imagemBanner', 'link', 'lojaId', 'lojaNome', 'precoNormal', 'precoPromocional', 'textoBotao', 'comentario', 'termina'];

function lerFormulario() {
  const f = form.elements;
  const dados = Object.fromEntries(CAMPOS.map((c) => [c, f[c].value]));
  dados.exibir = form.querySelector('[name="exibir"]:checked')?.value || 'ambos';
  dados.ativo = f.ativo.checked;
  if (dados.lojaId) dados.lojaNome = contexto.lojas.get(dados.lojaId)?.nome || '';
  return dados;
}

// objeto no mesmo formato que a vitrine usa, para a pré-visualização
function comoDestaque(d) {
  const normal = d.precoNormal === '' ? null : Number(d.precoNormal);
  const promo = d.precoPromocional === '' ? null : Number(d.precoPromocional);
  return {
    manual: true,
    moeda: 'BRL',
    dealID: 'previa',
    titulo: d.titulo || 'Título do destaque',
    imagem: d.imagem,
    imagemBanner: d.imagemBanner,
    link: d.link || '#',
    lojaId: d.lojaId,
    lojaNome: d.lojaNome,
    precoNormal: normal,
    precoPromocional: promo,
    desconto: normal && promo !== null ? Math.max(0, Math.round((1 - promo / normal) * 100)) : 0,
    textoBotao: d.textoBotao || 'Ver oferta',
    comentario: d.comentario,
  };
}

function atualizarPrevia() {
  const d = lerFormulario();
  campoLojaNome.hidden = Boolean(d.lojaId);
  const p = comoDestaque(d);
  previaCartao.innerHTML = d.exibir === 'banner' ? '<p class="secao-nota">Este destaque não aparece na faixa (só no banner).</p>' : cartaoJogo(p, { especial: true });
  previaBanner.hidden = d.exibir === 'faixa';
  previaBanner.innerHTML = `
    <div class="billboard-fundo">${imgJogo(p, 'banner', '')}</div>
    <div class="billboard-conteudo">
      <div class="billboard-rotulo">
        <span class="selo-tipo">Destaque</span>
        ${p.lojaId || p.lojaNome ? pilulaLoja(p.lojaId, p.lojaNome) : ''}
        ${p.desconto >= 1 ? `<span class="desconto" style="position:static">-${p.desconto}%</span>` : ''}
      </div>
      <h1>${esc(p.titulo)}</h1>
      ${p.comentario ? `<div class="billboard-comentario comentario-rico">${renderizarComentario(p.comentario)}</div>` : ''}
      ${precos(p)}
      <div class="billboard-acoes"><span class="botao">${esc(p.textoBotao)}</span></div>
    </div>`;
}

function mostrar(texto, tipo = '') {
  msg.textContent = texto;
  msg.className = `mensagem ${tipo}`;
}

function modoNovo() {
  editandoId = null;
  form.reset();
  titulo.textContent = 'Adicionar destaque';
  botaoSalvar.textContent = 'Adicionar aos destaques';
  botaoCancelar.hidden = true;
  atualizarPrevia();
  atualizarCamposImagem();
}

// Chamado pela aba Destaques ao clicar em "Editar" num destaque manual
export function editarManual(d) {
  editandoId = d.id;
  const f = form.elements;
  CAMPOS.forEach((c) => (f[c].value = d[c] ?? ''));
  f.termina.value = typeof d.termina === 'string' ? d.termina : '';
  (form.querySelector(`[name="exibir"][value="${d.exibir || 'ambos'}"]`) || {}).checked = true;
  f.ativo.checked = d.ativo !== false;
  titulo.textContent = `Editar: ${d.titulo}`;
  botaoSalvar.textContent = 'Salvar alterações';
  botaoCancelar.hidden = false;
  mostrar('');
  atualizarPrevia();
  atualizarCamposImagem();
}

export async function iniciarAdicionar({ depoisDeSalvar } = {}) {
  aoSalvar = depoisDeSalvar || aoSalvar;
  await carregarContexto();
  selectLoja.insertAdjacentHTML(
    'beforeend',
    [...contexto.lojas.values()].map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join(''),
  );

  let espera;
  form.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(atualizarPrevia, 150);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = lerFormulario();
    const erros = validarManual(dados);
    if (erros.length) return mostrar(erros.join(' '), 'erro');
    if (imagemComErro(form)) return mostrar('Uma das imagens não abre. Confira o link.', 'erro');
    botaoSalvar.disabled = true;
    try {
      if (editandoId) {
        await atualizarDestaqueManual(editandoId, dados);
        mostrar('Destaque atualizado.', 'ok');
      } else {
        await criarDestaqueManual(dados);
        mostrar('Destaque adicionado! Ele já aparece na vitrine.', 'ok');
      }
      modoNovo();
      aoSalvar();
    } catch (erro) {
      console.error(erro);
      mostrar('Não foi possível salvar. Confira se sua conta é admin e se as regras do Firestore estão publicadas.', 'erro');
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  botaoCancelar.addEventListener('click', () => {
    modoNovo();
    mostrar('');
  });

  ativarCamposImagem(form, atualizarPrevia);
  ativarEditores(form, atualizarPrevia);
  atualizarPrevia();
}
