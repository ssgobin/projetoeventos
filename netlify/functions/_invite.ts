import { buildInviteEmail, getTransport } from "./_email";

export function makeToken(bytes = 24) {
  const alphabet = "0123456789abcdef";
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => alphabet[value >> 4] + alphabet[value & 15]).join("");
}

export function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function makeSignupId(eventoId: string, email: string) {
  return `${eventoId}_${encodeURIComponent(email).replace(/[.%/[\]#?]/g, "_")}`;
}

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeImportValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[<>]/g, "").trim();
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function resolveSignupStatus(db: FirebaseFirestore.Firestore, evento: FirebaseFirestore.DocumentData, eventoId: string) {
  const capacidade = Number(evento.capacidade || 0);
  if (!capacidade) return "confirmado";

  const snap = await db.collection("inscricoes").where("eventoId", "==", eventoId).get();
  const confirmed = snap.docs.filter((doc) => doc.data().statusInscricao !== "espera").length;
  if (confirmed < capacidade) return "confirmado";
  if (evento.listaEsperaAtiva === false) throw new Error("Evento lotado");
  return "espera";
}

export async function sendInvite(db: FirebaseFirestore.Firestore, admin: typeof import("firebase-admin"), inscricaoRef: FirebaseFirestore.DocumentReference) {
  const inscricaoSnap = await inscricaoRef.get();
  if (!inscricaoSnap.exists) throw new Error("Inscrição não encontrada");

  const inscricao = { id: inscricaoSnap.id, ...inscricaoSnap.data()! } as FirebaseFirestore.DocumentData;
  const eventoSnap = await db.collection("eventos").doc(String(inscricao.eventoId)).get();
  if (!eventoSnap.exists) throw new Error("Evento não encontrado");

  const evento = { id: eventoSnap.id, ...eventoSnap.data()! } as FirebaseFirestore.DocumentData;
  try {
    await inscricaoRef.update({
      emailStatus: "pendente",
      emailErro: admin.firestore.FieldValue.delete(),
    });

    const inviteEmail = await buildInviteEmail(evento, inscricao);
    await getTransport().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Sistema de Eventos"}" <${process.env.SMTP_USER}>`,
      to: String(inscricao.email),
      subject: `Seu convite - ${evento.nome}`,
      html: inviteEmail.html,
      attachments: inviteEmail.attachments,
    });

    await inscricaoRef.update({
      emailEnviado: true,
      emailStatus: "enviado",
      emailErro: admin.firestore.FieldValue.delete(),
      emailEnviadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true as const, inscricaoId: inscricaoRef.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar convite";
    await inscricaoRef.update({
      emailEnviado: false,
      emailStatus: "falhou",
      emailErro: message,
      emailFalhouEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: false as const, inscricaoId: inscricaoRef.id, error: message };
  }
}
