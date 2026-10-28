# Buba Promo

Aplicação web de promoções de jogos de PC — Projeto integrador, Atividade 2. Tema escuro no estilo dos serviços de streaming, com cores de cada loja. Dados no **Firebase Firestore**, promoções da API pública **[CheapShark](https://www.cheapshark.com)**, jogos grátis da **[GamerPower](https://www.gamerpower.com)**, cotação do dólar da **[AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas)** e publicação no **Vercel**.

## Quem vê o quê

| Perfil | O que acessa |
| --- | --- |
| **Visitante** (sem login) | Só a **vitrine**: banner com os destaques, faixa **Destaques** (escolhidos a dedo), uma faixa horizontal por loja (Steam, Epic, GOG, Humble…) com o bloco da loja no começo, coluna **Grátis agora** e busca em todas as lojas. Todas as promoções entram automaticamente. |
| **Usuário** (com login) | Vitrine + **Recomendações do dia** + página **Notificar**: escolhe, na lista de jogos que já estiveram em oferta no Buba Promo, quais quer acompanhar (com preço-alvo opcional) e recebe avisos quando eles entram em promoção. O número de avisos novos aparece no menu. |
| **Admin** | **Painel**: averigua as promoções que chegam da CheapShark e escolhe a dedo os **destaques** (com comentário); atualiza preços e tira destaques encerrados; mantém o **catálogo de recomendações diárias** (links para qualquer jogo, notícia ou evento gamer). |

## Requisitos da atividade

| Requisito | Onde está |
| --- | --- |
| CRUD — `destaques` | **C** destacar (Painel › Averiguar) · **R** vitrine e Painel › Destaques · **U** atualizar preço · **D** tirar dos destaques |
| CRUD — `recomendacoes` | **C** publicar · **R** vitrine (logado) e catálogo no painel · **U** editar · **D** excluir |
| CRUD — `usuarios/{uid}/seguindo` | **C** Notificar · **R** lista "Escolha seus jogos" · **U** preço-alvo · **D** parar de notificar |
| API externa | `src/api.js` — CheapShark (`/deals`, `/deals?id=`, `/games?ids=`, `/stores`), GamerPower (`/giveaways`, via `api/gratis.js`) e AwesomeAPI (`USD-BRL`) |
| Publicação | Vercel, `https://<projeto>.vercel.app` |

## Estrutura

```
index.html                  Vitrine (pública) + recomendações do dia (logado)
loja.html                   Todas as promoções de uma loja em grade de tela cheia ("Ver todas")
busca.html                  Resultados da busca com filtros (loja, preço, desconto, grátis, ordem)
jogos.html                  Games: catálogo de todos os jogos que já passaram em promoção, com estrela
public/sw.js                Service worker para as notificações do navegador
entrar.html                 Login, cadastro, Google e "esqueci minha senha"
notificar.html              Jogos acompanhados e avisos (logado)
admin.html                  Painel do admin
src/firebase.js             Configuração do Firebase (projeto joao-iam)
src/sessao.js               Cabeçalho compartilhado, login e papel de admin
src/api.js                  CheapShark e AwesomeAPI
src/contexto.js             Cotação e lojas compartilhadas entre as telas
src/destaques.js            Coleção "destaques"
src/catalogo.js             Coleção "jogos" (catálogo Games): salvar, listar e sincronizar
src/estrela.js              Estrelar jogos (seguir) em qualquer página
src/notificacoes.js         Permissão e notificações do navegador
src/cartoes.js              Cartão de jogo e peças visuais compartilhadas
src/busca-global.js         Barra de busca do cabeçalho: sugestões, teclado, recentes, atalho "/"
src/lojas.js                Cores de cada loja, ordem das faixas, capas grandes da Steam
api/gratis.js               Função do Vercel que busca os jogos grátis da GamerPower
src/recomendacoes.js        Coleção "recomendacoes"
src/usuarios.js             Perfis, "seguindo" e avisos
src/vitrine.js / entrar.js / notificar.js / admin*.js   Lógica de cada página
privacidade.html            Política de privacidade e de cookies (LGPD)
termos.html                 Termos de uso
404.html                    Página de erro (o Vercel usa automaticamente)
src/site.js                 Rodapé, aviso de cookies com preferências e botão "voltar ao topo"
firestore.rules             Regras de segurança
```

### Coleções do Firestore

- `destaques/{dealID}` — promoções escolhidas a dedo: `dealID`, `gameID`, `titulo`, `lojaId`, `precoNormal`, `precoPromocional` (US$), `desconto`, `imagem`, `avaliacao`, `metacritic`, `link`, `comentario`, `criadoEm`, `atualizadoEm`.
- `jogos/{gameID}` — todo jogo que já foi destaque: `titulo`, `imagem`, `ultimaPromocaoEm`. Junto com as ofertas atuais da CheapShark, forma a lista do Notificar.
- `recomendacoes` — `tipo` (jogo, notícia ou evento), `titulo`, `descricao`, `link`, `imagem`, `data` (AAAA-MM-DD), `criadoEm`.
- `usuarios/{uid}` — `nome`, `email`, `avisosLidosEm`; subcoleção `seguindo/{gameID}` com `titulo`, `imagem`, `precoAlvo` (R$ ou null).
- `admins/{uid}` — documento que dá acesso ao painel (criado à mão no console).

### Como funcionam os avisos

Na página Notificar, o usuário marca os jogos que quer acompanhar (lista = jogos em oferta agora + jogos que já foram destaque + busca por nome). Os avisos são consultados ao vivo na CheapShark (`/games?ids=`): toda promoção atual desses jogos, respeitando o preço-alvo. As que o usuário ainda não marcou como lidas aparecem como **Novo** e contam no menu.

## Configurar o Firebase (projeto `joao-iam`)

1. **Authentication → Sign-in method**: ative **E-mail/senha** e **Google**.
2. **Firestore Database**: crie o banco (modo produção) → aba **Regras** → cole o conteúdo de `firestore.rules` → **Publicar**.
3. **Admins**: `bedimjoaovictor@gmail.com` e `bobapromo@gmail.com` (lista em `src/admins.js` e na função `admin()` de `firestore.rules` — mude nos dois lugares). Só vale com **e-mail verificado**: entrar com o Google já conta; contas com senha recebem um link de verificação no cadastro (o painel tem botão para reenviar). Também dá para liberar outra conta criando no Firestore o documento `admins/{UID}` (o painel mostra o UID).
4. Depois do deploy, em **Authentication → Settings → Authorized domains**, adicione `seu-projeto.vercel.app`.

A configuração do app web já está em `src/firebase.js`; não é preciso cadastrar variáveis de ambiente. (Essa chave não é secreta: quem protege os dados são as regras do Firestore.)

## Rodar no computador

```bash
npm install
npm run dev
```

## Publicar no Vercel

Importe o repositório em <https://vercel.com/new>. O preset **Vite** é detectado (build `npm run build`, saída `dist`). Clique em **Deploy**. Cada `git push` na `main` publica uma nova versão.

## Games, estrela e notificações

- **Games** (`/jogos.html`): todo jogo que já apareceu em promoção fica salvo na coleção `jogos`. O catálogo cresce sozinho quando usuários logados navegam (cada jogo é gravado no máximo uma vez por dia por navegador) e o admin pode puxar ~600 de uma vez em **Painel › Destaques › Sincronizar catálogo Games**.
- **Estrela ☆**: em qualquer cartão (vitrine, loja, Games). Estrelar grava em `usuarios/{uid}/seguindo` e, na primeira vez, o navegador pede permissão para notificações.
- **Notificações**: com o site aberto em alguma aba, os jogos estrelados são conferidos ao abrir e a cada 15 minutos; promoções novas viram notificação do navegador (via `public/sw.js`, necessário no Android). Avisar com o navegador fechado exigiria um servidor de push (Firebase Cloud Messaging + back-end), fora do escopo.

## Preços em reais

A CheapShark informa os preços em dólar das lojas americanas. Para as ofertas da **Steam**, o site busca o **preço oficial da Steam Brasil em reais** (função `api/precos-steam.js`, que consulta a Steam com `cc=br`) — a Steam tem preço regional, quase sempre menor que "dólar × cotação". Nas outras lojas o valor é a conversão pela cotação do dia e aparece com **≈**. Em jogos com várias lojas, o número grande é o **menor preço**; a média entre as lojas aparece só como referência.

## Busca

A barra fica no cabeçalho de todas as páginas: sugestões com capa e menor preço enquanto você digita (CheapShark `/games?title=`), trecho buscado em destaque, setas ↑ ↓ + Enter, Esc para fechar, botão de limpar, buscas recentes (só se o usuário permitir "Preferências" nos cookies) e atalho **/** para focar. No celular, a lupa abre a busca em tela cheia. Enter leva para `/busca.html?q=…`, com filtros de loja, preço máximo em R$, desconto mínimo, só grátis e ordenação — todos guardados no endereço, para o link poder ser compartilhado — e uma lista de jogos com o mesmo nome que não estão em promoção, para estrelar.

## Painel do admin

- **Resumo** no topo: destaques ativos, pausados, adicionados à mão, recomendações de hoje e jogos no catálogo.
- **Averiguar promoções**: promoções que chegam da CheapShark, com os mesmos atalhos e filtros do Explorar (aclamados, avaliados na Steam, descontos, AAA, preço, notas, "Carregar mais") e "★ Destacar".
- **★ Destacar** abre uma janela com os destaques atuais lado a lado: escolha qual o novo **substitui** (herda posição e onde aparece) ou adicione sem tirar ninguém; com comentário, **vídeo** e **📌 Fixo**. Se o jogo já está em destaque em outra loja, as lojas são atreladas a um cartão só ("Escolher loja").
- **⚡ Adicionar automaticamente**: escolha uma métrica de qualidade (custo-benefício, Metacritic, avaliação na Steam, descontos com nota boa, AAA) e quantos; os melhores entram no topo.
- **Rodízio de 24 h**: todo destaque que não é fixo sai depois de 24 horas no ar e dá lugar ao próximo melhor da métrica escolhida (sem diferença entre destaques automáticos e escolhidos à mão). A vitrine já mostra a troca para todos; o painel grava a troca no Firestore ao abrir e a cada 5 minutos (`src/rodizio.js`, documento `config/rodizio`).
- **Trailer ao passar o mouse**: nos cartões e no banner, depois de um instante com o mouse em cima, toca o vídeo atrelado (YouTube, .mp4 ou .webm) ou o trailer curto da Steam, via `api/trailer.js`.
- **Destaques**: ordem (↑ ↓), onde aparece (banner e faixa, só banner ou só faixa), pausar/ativar sem apagar, editar comentário, situação ao vivo (no ar, preço mudou, encerrada), salvar preço novo, remover encerrados, filtros e busca.
- **＋ Adicionar**: destaque criado à mão para algo que não vem da API (jogo de outra loja, evento, anúncio): título, imagens do cartão e do banner, link, loja, preço em R$ (opcional), texto do botão, comentário, data de término e onde aparece, com pré-visualização ao vivo.
- **Recomendações diárias**: CRUD do catálogo de jogos, notícias e eventos.

## Explorar

`/busca.html` funciona com ou sem nome digitado. Atalhos prontos: Mais aclamados (Metacritic), Mais bem avaliados na Steam, Lançamentos, Maiores descontos, AAA em promoção, Até R$ 20, Entraram agora e Grátis. Filtros: loja, preço máximo, desconto mínimo, nota Steam mínima, Metacritic mínimo, só AAA, só grátis e 8 ordenações.
