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
entrar.html                 Login, cadastro, Google e "esqueci minha senha"
notificar.html              Jogos acompanhados e avisos (logado)
admin.html                  Painel do admin
src/firebase.js             Configuração do Firebase (projeto joao-iam)
src/sessao.js               Cabeçalho compartilhado, login e papel de admin
src/api.js                  CheapShark e AwesomeAPI
src/contexto.js             Cotação e lojas compartilhadas entre as telas
src/destaques.js            Coleções "destaques" e "jogos"
src/lojas.js                Cores de cada loja, ordem das faixas, capas grandes da Steam
api/gratis.js               Função do Vercel que busca os jogos grátis da GamerPower
src/recomendacoes.js        Coleção "recomendacoes"
src/usuarios.js             Perfis, "seguindo" e avisos
src/vitrine.js / entrar.js / notificar.js / admin*.js   Lógica de cada página
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
3. **Tornar-se admin**: crie sua conta no site (página Entrar) e abra `/admin.html` — a página mostra o seu UID. No Firestore, crie a coleção `admins` com um documento cujo **ID é esse UID** (pode ter um campo qualquer, como `nome`). Recarregue o painel.
4. Depois do deploy, em **Authentication → Settings → Authorized domains**, adicione `seu-projeto.vercel.app`.

A configuração do app web já está em `src/firebase.js`; não é preciso cadastrar variáveis de ambiente. (Essa chave não é secreta: quem protege os dados são as regras do Firestore.)

## Rodar no computador

```bash
npm install
npm run dev
```

## Publicar no Vercel

Importe o repositório em <https://vercel.com/new>. O preset **Vite** é detectado (build `npm run build`, saída `dist`). Clique em **Deploy**. Cada `git push` na `main` publica uma nova versão.
