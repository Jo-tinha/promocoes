// Janela do "★ Destacar": mostra os destaques atuais lado a lado para escolher qual o novo substitui
// (ou entrar sem substituir), com comentário, vídeo (trailer) e a opção de fixar.
import { destacar, removerDestaque } from './destaques.js';
import { precoEmReal, nomeDaLoja } from './contexto.js';
import { imgJogo, idSteam } from './lojas.js';
import { videoDoJogo, videoValido, idYoutube } from './trailer.js';
import { tempoRestante } from './rodizio.js';
import { esc, formatarReal } from './util.js';
import { nomeNormalizado } from './cartoes.js';

const valor = (p, v) => (p.moeda === 'BRL' ? formatarReal(v) : precoEmReal(v));

function horas(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

function cartaoAtual(d) {
  const restante = tempoRestante(d);
  const situacao = d.emAlta
    ? 'no banner enquanto não houver destaque'
    : !d.ativo
      ? 'Pausado'
      : d.fixo
        ? '📌 Fixo'
        : restante
          ? `sai em ${horas(restante)}`
          : 'troca no próximo rodízio';
  return `
    <button type="button" class="opcao-substituir" data-substituir="${esc(d.id)}" aria-pressed="false">
      <span class="opcao-capa jogo-capa">${imgJogo(d)}</span>
      <span class="opcao-texto">
        <strong title="${esc(d.titulo)}">${esc(d.titulo)}</strong>
        <small>${d.precoPromocional == null ? 'sem preço' : d.precoPromocional === 0 ? 'Grátis' : valor(d, d.precoPromocional)} · ${esc(d.lojaNome || nomeDaLoja(d.lojaId))}</small>
        <small class="opcao-situacao">${situacao}</small>
      </span>
      <span class="opcao-marca" aria-hidden="true">Substituir</span>
    </button>`;
}

// Devolve true se destacou
export function abrirDestacar(promo, atuais) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo-destacar';
    const lista = atuais.filter((d) => d.emPromocao !== false);
    // mesmo jogo já em destaque (em outra loja)? Os dois viram um cartão só, com "Escolher loja"
    const mesmoJogo = lista.filter((d) => !d.manual && nomeNormalizado(d.titulo) === nomeNormalizado(promo.titulo));
    dialogo.innerHTML = `
      <form method="dialog" class="destacar-conteudo">
        <header class="destacar-topo">
          <div class="destacar-novo">
            <span class="jogo-capa">${imgJogo(promo)}</span>
            <div>
              <span class="selo-tipo">Novo destaque</span>
              <h2>${esc(promo.titulo)}</h2>
              <p class="secao-nota">${esc(nomeDaLoja(promo.lojaId))} · <s>${precoEmReal(promo.precoNormal)}</s> <strong>${precoEmReal(promo.precoPromocional)}</strong> (-${promo.desconto}%)</p>
            </div>
          </div>
          <button class="escolha-fechar" type="button" data-cancelar aria-label="Fechar">×</button>
        </header>

        ${
          mesmoJogo.length
            ? `<p class="aviso">🔗 <strong>${esc(promo.titulo)}</strong> já está nos destaques (${mesmoJogo.map((d) => esc(d.lojaNome || nomeDaLoja(d.lojaId))).join(', ')}).
               Adicionando, esta loja é <strong>atrelada ao mesmo cartão</strong>: na vitrine aparece um destaque só, com o preço médio e “Escolher loja”.</p>`
            : ''
        }
        <section>
          <h3>Onde ele entra?</h3>
          <p class="secao-nota">Escolha um destaque atual para ser substituído (o novo herda a posição e onde aparece) ou adicione sem tirar ninguém.</p>
          <div class="grade-substituir">
            <button type="button" class="opcao-substituir opcao-adicionar" data-substituir="" aria-pressed="true">
              <span class="opcao-capa opcao-mais" aria-hidden="true">＋</span>
              <span class="opcao-texto"><strong>Adicionar sem substituir</strong><small>entra no começo da lista</small></span>
              <span class="opcao-marca" aria-hidden="true">Escolhido</span>
            </button>
            ${lista.map(cartaoAtual).join('')}
          </div>
        </section>

        <section class="destacar-campos">
          <label>Comentário <small>(opcional, aparece no cartão e no banner)</small>
            <input name="comentario" maxlength="140" placeholder="Ex.: Menor preço do ano" />
          </label>
          <label>Vídeo <small>(opcional — YouTube, .mp4 ou .webm; toca quando passam o mouse)</small>
            <input name="video" type="url" placeholder="${idSteam(promo) ? 'Vazio = trailer da Steam automático' : 'https://www.youtube.com/watch?v=…'}" />
          </label>
          <p class="secao-nota" id="situacao-video">${idSteam(promo) ? 'Procurando o trailer da Steam…' : 'Este jogo não tem página na Steam: sem trailer automático.'}</p>
          <label class="check-filtro"><input type="checkbox" name="fixo" /> 📌 Fixo — não sai no rodízio de 24 horas</label>
        </section>

        <p class="mensagem erro" id="erro-destacar" hidden></p>
        <footer class="form-acoes">
          <button class="botao secundario" type="button" data-cancelar>Cancelar</button>
          <button class="botao" type="submit" id="confirmar-destacar">★ Destacar</button>
        </footer>
      </form>`;
    document.body.append(dialogo);
    const form = dialogo.querySelector('form');
    const confirmar = dialogo.querySelector('#confirmar-destacar');
    const campoVideo = form.elements.video;
    const situacaoVideo = dialogo.querySelector('#situacao-video');
    let substituir = '';

    const fechar = (resultado) => {
      dialogo.close();
      dialogo.remove();
      resolver(resultado);
    };
    dialogo.addEventListener('cancel', (e) => {
      e.preventDefault();
      fechar(false);
    });
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-cancelar]')) return fechar(false);
      const opcao = e.target.closest('[data-substituir]');
      if (!opcao) return;
      substituir = opcao.dataset.substituir;
      dialogo.querySelectorAll('[data-substituir]').forEach((b) => b.setAttribute('aria-pressed', String(b === opcao)));
      const alvo = lista.find((d) => d.id === substituir);
      confirmar.textContent = alvo ? `★ Substituir “${alvo.titulo.length > 28 ? `${alvo.titulo.slice(0, 26)}…` : alvo.titulo}”` : '★ Destacar';
    });

    // mostra se há trailer automático da Steam
    if (idSteam(promo)) {
      videoDoJogo({ steam: idSteam(promo) }).then((info) => {
        if (campoVideo.value.trim()) return;
        situacaoVideo.textContent = info
          ? '✓ Trailer da Steam encontrado: toca sozinho quando passarem o mouse. Cole um link só se quiser outro vídeo.'
          : 'Não achei trailer na Steam para este jogo (ou o site está rodando sem o Vercel). Cole um link se quiser.';
      });
    }
    campoVideo.addEventListener('input', () => {
      const v = campoVideo.value.trim();
      if (!v) return;
      situacaoVideo.textContent = videoValido(v)
        ? `✓ ${idYoutube(v) ? 'Vídeo do YouTube' : 'Arquivo de vídeo'} — toca sem som, em loop, ao passar o mouse.`
        : 'Use um link do YouTube ou de um arquivo .mp4/.webm.';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erro = dialogo.querySelector('#erro-destacar');
      const video = campoVideo.value.trim();
      if (video && !videoValido(video)) {
        erro.textContent = 'O vídeo precisa ser um link do YouTube ou de um arquivo .mp4/.webm.';
        erro.hidden = false;
        return;
      }
      confirmar.disabled = true;
      confirmar.textContent = 'Salvando…';
      const alvo = lista.find((d) => d.id === substituir);
      try {
        await destacar(promo, {
          comentario: form.elements.comentario.value,
          video,
          fixo: form.elements.fixo.checked,
          // substituindo: entra no lugar do outro; adicionando: no começo da lista
          ordem: alvo && !alvo.emAlta ? alvo.ordem ?? -Date.now() / 1e6 : -Date.now() / 1e6,
          exibir: alvo && !alvo.emAlta ? alvo.exibir || 'ambos' : 'ambos',
        });
        // destaque automático do rodízio (ainda não gravado): sai o que ele substituiu
        // "Em alta" (banner sem destaques): não há o que remover, ele some quando entra um destaque
        if (alvo?.substitui) await removerDestaque(alvo.substitui.id);
        else if (alvo && !alvo.emAlta) await removerDestaque(alvo.id);
        fechar(true);
      } catch (falha) {
        console.error(falha);
        erro.textContent = 'Não foi possível destacar. Confira se sua conta é admin e se as regras do Firestore foram publicadas.';
        erro.hidden = false;
        confirmar.disabled = false;
        confirmar.textContent = '★ Destacar';
      }
    });

    dialogo.showModal();
  });
}
