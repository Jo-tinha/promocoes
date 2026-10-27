# Vitrine de Ofertas

Aplicação web de ofertas de produtos — Projeto integrador, Atividade 2.

- **Ofertas oficiais**: cadastradas por um administrador, com CRUD completo no **Firebase Firestore**.
- **Catálogo de produtos**: obtido em tempo real da API pública **[DummyJSON](https://dummyjson.com/docs/products)**, com preços convertidos para reais pela cotação do dólar da **[AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas)**.
- **Publicação**: Vercel (`.vercel.app`).

## Requisitos da atividade

| Requisito | Onde está |
| --- | --- |
| C — Cadastrar | Painel (`/admin.html`) → formulário "Nova oferta" → `addDoc` |
| R — Consultar | Vitrine (`/`) e tabela do painel → `getDocs` |
| U — Atualizar | Botão **Editar** (e Ativar/Desativar) → `updateDoc` |
| D — Excluir | Botão **Excluir**, com confirmação → `deleteDoc` |
| API externa | `src/api.js` — DummyJSON (produtos, busca, categorias) e AwesomeAPI (USD-BRL) |
| Publicação | Vercel, endereço `https://<projeto>.vercel.app` |

## Estrutura

```
index.html        Vitrine pública
admin.html        Login + painel do administrador
src/firebase.js   Inicialização do Firebase (lê as variáveis VITE_FIREBASE_*)
src/ofertas.js    CRUD da coleção "ofertas" e validação
src/api.js        Consumo das APIs públicas
src/vitrine.js    Lógica da vitrine
src/admin.js      Lógica do login e do painel
src/style.css     Estilos
firestore.rules   Regras de segurança do Firestore
```

Documento da coleção `ofertas`: `titulo`, `descricao`, `categoria`, `precoOriginal`, `precoOferta`, `imagemUrl`, `validoAte` (timestamp ou null), `ativa` (boolean), `criadoEm` (timestamp do servidor).

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
