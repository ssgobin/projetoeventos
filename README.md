# EventOS - SaaS multiempresa para eventos

Sistema web completo para organizadoras gerenciarem eventos, formularios publicos, convidados, convites por e-mail, QR Code e check-in.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + componentes estilo Shadcn/UI
- React Hook Form + Zod
- Firebase Auth + Firestore + Hosting
- Netlify Functions para SMTP, reenvio, check-in e exportacao
- Appwrite Storage para imagens e arquivos
- Nodemailer SMTP Gmail
- `qrcode.react`, `qrcode` e `html5-qrcode`

## Configuracao

1. Instale dependencias:

```bash
npm install
```

2. Crie `.env` a partir de `.env.example`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_do_sistema@gmail.com
SMTP_PASS=senha_de_app_do_gmail
SMTP_FROM_NAME=Sistema de Eventos
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"projetoeventos-c6466","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-...@projetoeventos-c6466.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}
```

Para obter esse JSON, gere uma chave em Firebase Console > Configuracoes do projeto > Contas de servico > Gerar nova chave privada. Cole o conteudo inteiro em uma linha no `.env` local e nas variaveis de ambiente da Netlify.

3. Rode localmente com Netlify Dev:

```bash
npm run dev
```

App: `http://localhost:8888`

## Firebase

O app usa o projeto `projetoeventos-c6466` com a config solicitada em `src/services/firebase.ts`.

Arquivos incluidos:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase.json`
- `.firebaserc`

Publique regras e indices:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## Appwrite

O service `src/services/appwrite.ts` usa:

- endpoint: `https://nyc.cloud.appwrite.io/v1`
- projectId: `6a199b240039ee847a5e`
- bucketId: `6a199b38001ad007a77a`

Ele valida tipo/tamanho, comprime imagens quando possivel, envia, gera preview/public URL, exclui e atualiza arquivos. No Firestore ficam apenas `fileId` e `url`.

## Fluxo principal

1. Empresa cria conta em `/cadastro`
2. Faz login em `/login`
3. Cria evento em `/eventos/novo`
4. Monta formulario em `/eventos/:id/formulario`
5. Publica formulario com e-mail obrigatorio
6. Convidado acessa `/form/:eventoId`
7. Inscricao gera token, codigo e QR Code
8. Netlify Function envia convite por SMTP Gmail
9. Operador acessa `/eventos/:id/checkin`
10. Camera le QR Code e a funcao valida empresa/evento/token
11. Operador confirma check-in
12. Lista em `/eventos/:id/inscritos` permite filtros, busca, reenvio e Excel

## Seguranca

- Firebase Auth para login
- Regras Firestore com isolamento por `empresaId`
- Roles `adminGeral`, `empresaAdmin`, `operador`
- Check-in apenas via area autenticada
- Netlify Functions verificam ID token com `firebase-admin`
- SMTP somente via variaveis de ambiente
- Appwrite Storage separado de Firestore
- Upload com validacao e compressao
- QR token seguro via Web Crypto
- Confirmacao antes de excluir evento

## Deploy Netlify

Configure as variaveis de ambiente no Netlify e publique:

```bash
netlify deploy --build
netlify deploy --prod --build
```

`netlify.toml` ja aponta `dist` e `netlify/functions`.

## Seed

Com `FIREBASE_SERVICE_ACCOUNT_JSON` configurado:

```bash
npm run seed
```

O seed cria empresa, usuario documental, evento e formulario demo. Para login real, crie o usuario no Firebase Authentication e mantenha o documento em `usuarios` com o UID correto.
