# Buba Promo

Aplicação web de promoções — Projeto integrador, Atividade 2.

- **Ofertas oficiais**: cadastradas pelo administrador, com CRUD completo no **Firebase Firestore**.
- **Recomendações**: promoções escolhidas pelo administrador, com um comentário, exibidas na vitrine.
- **Notificar (inspeção diária)**: catálogo de alertas do administrador (jogo, preço máximo, loja). Ao abrir o painel, cada alerta é verificado na API e as promoções que ainda não tinham aparecido são destacadas como **novas**; o admin pode recomendá-las e conclui a inspeção do dia.
- **Promoções nas lojas**: promoções reais de jogos de PC (Steam, Epic, GOG, Humble e outras) da API pública **[CheapShark](https://www.cheapshark.com)**, com preços convertidos para reais pela cotação do dólar da **[AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas)**.
- **Login de administrador**: Firebase Authentication (e-mail e senha). Visitantes só leem; tudo o que grava exige login.
- **Publicação**: Vercel (`.vercel.app`).

## Requisitos da atividade

O CRUD completo existe em três coleções do Firestore:

| Operação | `ofertas` (aba Ofertas oficiais) | `notificar` (aba Inspeção diária) | `recomendacoes` (aba Recomendações) |
| --- | --- | --- | --- |
| C — Cadastrar | Formulário "Nova oferta" | Formulário "Novo alerta" | Botão **Recomendar** numa promoção da inspeção |
| R — Consultar | Vitrine e tabela do painel | Lista de alertas com as promoções atuais | Vitrine e tabela do painel |
| U — Atualizar | **Editar**, **Ativar/Desativar** | **Editar**, **Pausar/Ativar**, **Concluir inspeção** | **Editar comentário** |
| D — Excluir | **Excluir** | **Excluir** | **Excluir** |

| Requisito | Onde está |
| --- | --- |
| API externa | `src/api.js` — CheapShark (`/deals` promoções e busca, `/stores` lojas) e AwesomeAPI (USD-BRL) |
| Publicação | Vercel, endereço `https://<projeto>.vercel.app` |

## Estrutura

```
index.html                  Vitrine pública: ofertas oficiais, recomendações e promoções
admin.html                  Login + painel do administrador (abas)
src/firebase.js             Inicialização do Firebase (lê as variáveis VITE_FIREBASE_*)
src/ofertas.js              CRUD da coleção "ofertas"
src/recomendacoes.js        CRUD da coleção "recomendacoes"
src/notificar.js            CRUD da coleção "notificar" e registro da inspeção
src/api.js                  Consumo das APIs públicas
src/contexto.js             Cotação do dólar e lojas, compartilhadas entre as telas
src/vitrine.js              Lógica da vitrine
src/admin.js                Login e troca de abas do painel
src/admin-notificar.js      Aba Inspeção diária
src/admin-recomendacoes.js  Aba Recomendações
src/admin-ofertas.js        Aba Ofertas oficiais
src/style.css               Estilos
firestore.rules             Regras de segurança do Firestore
```

Coleções do Firestore:

- `ofertas`: `titulo`, `descricao`, `categoria`, `precoOriginal`, `precoOferta`, `imagemUrl`, `validoAte`, `ativa`, `criadoEm`.
- `recomendacoes`: `dealID`, `titulo`, `lojaId`, `precoNormal`, `precoPromocional` (em dólar, no momento da recomendação), `desconto`, `imagem`, `link`, `comentario`, `criadoEm`.
- `notificar`: `termo`, `precoMaximo` (R$ ou null), `lojaId`, `ativo`, `vistos` (IDs das promoções já inspecionadas), `ultimaInspecao`, `criadoEm`.

### Como funciona a inspeção diária

1. O admin cadastra alertas no catálogo **Notificar**.
2. Ao entrar no painel, cada alerta ativo é consultado na CheapShark (título + loja), filtrado pelo preço máximo em reais.
3. Promoções cujo ID não está em `vistos` aparecem como **Nova**; a aba mostra o total de novas e se a inspeção de hoje está pendente.
4. O admin recomenda as que quiser e clica em **Concluir inspeção**: os IDs atuais entram em `vistos` e `ultimaInspecao` recebe a data de hoje.

## 1. Configurar o Firebase

1. Em <https://console.firebase.google.com>, crie um projeto.
2. **Firestore Database** → Criar banco de dados (modo produção) → aba **Regras** → cole o conteúdo de `firestore.rules` → Publicar.
3. **Authentication** → Primeiros passos → ative **E-mail/senha** → aba **Usuários** → **Adicionar usuário** (esse é o login do administrador).
4. **Configurações do projeto** → **Seus apps** → adicione um app **Web** (`</>`) e copie os valores do `firebaseConfig`.

## 2. Rodar no computador

```bash
cp .env.example .env   # preencha com os valores do firebaseConfig
npm install
npm run dev
```

Abra o endereço mostrado no terminal. O painel fica em `/admin.html`.

## 3. Publicar no Vercel

1. Em <https://vercel.com/new>, importe este repositório do GitHub. O preset **Vite** é detectado sozinho (build `npm run build`, saída `dist`).
2. Em **Environment Variables**, cadastre as mesmas variáveis do `.env`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. Clique em **Deploy**.
4. No Firebase, em **Authentication → Configurações → Domínios autorizados**, adicione o domínio `seu-projeto.vercel.app`.

A cada `git push` na branch `main`, o Vercel publica uma nova versão.

> A chave do Firebase para web não é secreta: quem protege os dados são as regras do Firestore, que só permitem escrita para usuários autenticados.
