import admin from "firebase-admin";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!admin.apps.length) {
  admin.initializeApp(
    serviceAccount
      ? { credential: admin.credential.cert(JSON.parse(serviceAccount)), projectId: "projetoeventos-c6466" }
      : { projectId: "projetoeventos-c6466" }
  );
}

const db = admin.firestore();

async function main() {
  const empresaId = "demo-empresa";
  const uid = "demo-admin";
  const eventoRef = db.collection("eventos").doc("demo-evento");

  await db.collection("empresas").doc(empresaId).set({
    nome: "Organizadora Demo",
    email: "demo@eventos.com",
    status: "ativa",
    plano: "premium",
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("usuarios").doc(uid).set({
    empresaId,
    nome: "Admin Demo",
    email: "demo@eventos.com",
    role: "empresaAdmin",
    ativo: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  await eventoRef.set({
    empresaId,
    nome: "Summit de Experiencias 2026",
    descricao: "Evento demo para validar formulario publico, convite e check-in.",
    local: "Centro de Convencoes",
    dataEvento: admin.firestore.Timestamp.fromDate(new Date("2026-08-20T19:00:00-03:00")),
    status: "ativo",
    corPrincipal: "#111827",
    tema: "light",
    permitirDuplicidadeEmail: false,
    mensagemConvite: "Obrigado por se inscrever. Apresente seu QR Code na entrada.",
    mensagemSucesso: "Inscricao confirmada com sucesso.",
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection("formularios").doc(eventoRef.id).set({
    empresaId,
    eventoId: eventoRef.id,
    titulo: "Credenciamento Summit de Experiencias",
    descricao: "Preencha seus dados para receber o convite com QR Code.",
    campos: [
      { id: "nome", label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
      { id: "email", label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      { id: "cpf", label: "CPF", name: "cpf", type: "cpf", required: false, ordem: 3 },
      { id: "empresa", label: "Empresa", name: "empresa", type: "text", required: false, ordem: 4 },
    ],
    emailObrigatorio: true,
    publicado: true,
    tema: { corPrincipal: "#111827", modo: "light" },
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("Seed criado. Crie manualmente um usuario no Firebase Auth e vincule o UID ao documento usuarios se quiser logar com ele.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
