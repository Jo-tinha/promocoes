// Janela do "★ Destacar": mostra os destaques atuais lado a lado para escolher qual o novo substitui
// (ou entrar sem substituir), com comentário, vídeo (trailer) e a opção de fixar.
import { destacar, removerDestaque, definirImagensDestaque } from './destaques.js';
import { campoImagem, ativarCamposImagem, imagemComErro } from './imagem-ideal.js';
import { precoEmReal, nomeDaLoja } from './contexto.js';
import { imgJogo, idSteam, fontesAutomaticas } from './lojas.js';
import { campoVideo, ativarCampoVideo, videoComErro, pararPrevias } from './admin-video.js';
import { tempoRestante, gravarAutomaticos } from './rodizio.js';
import { esc, formatarReal } from './util.js';
import { nomeNormalizado } from './cartoes.js';
import { editorComentario, ativarEditores } from './texto-rico.js';

const valor = (p, v) => (p.moeda === 'BRL' ? formatarReal(v) : precoEmReal(v));

function horas(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

function cartaoAtual(d) {
  const restante = tempoRestante(d);
  const situacao = !d.ativo
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
      <form method="dialog" class="destacar-conteudo" novalidate>
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

        <section class="destacar-imagens">
          <h3>🖼 Imagens</h3>
          <p class="secao-nota">Deixe vazio para usar a arte automática. Se ela estiver borrada ou cortada, troque por uma na resolução indicada.</p>
          ${campoImagem({ nome: 'imagemCartao', tipo: 'cartao', automatica: fontesAutomaticas(promo, 'cartao'), jogo: promo })}
          ${campoImagem({ nome: 'imagemBanner', tipo: 'banner', automatica: fontesAutomaticas(promo, 'banner'), jogo: promo })}
        </section>

        <section class="destacar-campos">
          <div class="campo-editor"><strong>Comentário</strong> <small>(opcional, aparece no cartão e no banner)</small>
            ${editorComentario({ nome: 'comentario' })}
          </div>
          <div class="campo-editor"><strong>Vídeo</strong> <small>(toca sem som quando passam o mouse)</small>
            ${campoVideo({ nome: 'video', jogo: promo })}
          </div>
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
    ativarCampoVideo(dialogo);
    ativarCamposImagem(dialogo);
    ativarEditores(dialogo);
    let substituir = '';

    const fechar = (resultado) => {
      pararPrevias(dialogo);
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erro = dialogo.querySelector('#erro-destacar');
      const video = form.elements.video.value.trim();
      if (imagemComErro(dialogo)) {
        erro.textContent = 'Uma das imagens não abre. Corrija o link ou deixe o campo vazio para usar a automática.';
        erro.hidden = false;
        return;
      }
      if (videoComErro(dialogo)) {
        erro.textContent = 'O link do vídeo não é válido. Corrija ou escolha outra opção de vídeo.';
        erro.hidden = false;
        return;
      }
      confirmar.disabled = true;
      confirmar.textContent = 'Salvando…';
      const alvo = lista.find((d) => d.id === substituir);
      try {
        await destacar(promo, {
          comentario: form.elements.comentario.value,
          imagemCartao: form.elements.imagemCartao.value,
          imagemBanner: form.elements.imagemBanner.value,
          video,
          fixo: form.elements.fixo.checked,
          // substituindo: entra no lugar do outro; adicionando: no começo da lista
          ordem: alvo ? alvo.ordem ?? -Date.now() / 1e6 : -Date.now() / 1e6,
          exibir: alvo?.exibir || 'ambos',
        });
        // destaque automático (ainda só na tela): se veio do rodízio, sai o que ele substituiu;
        // se completava a vitrine, não há documento para apagar
        if (alvo?.substitui) await removerDestaque(alvo.substitui.id);
        else if (alvo && !alvo.automatico) await removerDestaque(alvo.id);
        // os outros automáticos que estavam na tela são gravados, para a vitrine continuar igual
        for (const d of lista.filter((x) => x.substitui && x !== alvo)) await removerDestaque(d.substitui.id);
        await gravarAutomaticos(lista, { exceto: alvo?.id });
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

// Trocar as imagens de um destaque que já está no ar (painel › Destaques › 🖼 Imagens)
export function abrirTrocarImagens(d) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo-destacar';
    dialogo.innerHTML = `
      <form method="dialog" class="destacar-conteudo" novalidate>
        <header class="destacar-topo">
          <div><span class="selo-tipo">Imagens do destaque</span><h2>${esc(d.titulo)}</h2></div>
          <button class="escolha-fechar" type="button" data-cancelar aria-label="Fechar">×</button>
        </header>
        <section class="destacar-imagens">
          <p class="secao-nota">Deixe vazio para usar a arte automática. A prévia mostra o recorte como aparece no site.</p>
          ${campoImagem({ nome: 'imagemCartao', tipo: 'cartao', valor: d.imagemCartao || '', automatica: fontesAutomaticas(d, 'cartao'), jogo: d })}
          ${campoImagem({ nome: 'imagemBanner', tipo: 'banner', valor: d.imagemBanner || '', automatica: fontesAutomaticas(d, 'banner'), jogo: d })}
        </section>
        <p class="mensagem erro" data-erro hidden></p>
        <footer class="form-acoes">
          <button class="botao secundario" type="button" data-cancelar>Cancelar</button>
          <button class="botao" type="submit">Salvar imagens</button>
        </footer>
      </form>`;
    document.body.append(dialogo);
    const form = dialogo.querySelector('form');
    const fechar = (r) => {
      dialogo.close();
      dialogo.remove();
      resolver(r);
    };
    dialogo.addEventListener('cancel', (e) => {
      e.preventDefault();
      fechar(false);
    });
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo || e.target.closest('[data-cancelar]')) fechar(false);
    });
    ativarCamposImagem(dialogo);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erro = dialogo.querySelector('[data-erro]');
      if (imagemComErro(dialogo)) {
        erro.textContent = 'Uma das imagens não abre. Corrija o link ou deixe o campo vazio.';
        erro.hidden = false;
        return;
      }
      const botao = form.querySelector('[type="submit"]');
      botao.disabled = true;
      try {
        const dados = { imagemCartao: form.elements.imagemCartao.value, imagemBanner: form.elements.imagemBanner.value };
        await definirImagensDestaque(d.id, dados);
        fechar(dados);
      } catch (falha) {
        console.error(falha);
        erro.textContent = 'Não foi possível salvar. Tente de novo.';
        erro.hidden = false;
        botao.disabled = false;
      }
    });
    dialogo.showModal();
  });
}
