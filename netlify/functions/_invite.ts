import { buildInviteEmail, buildScheduledEmail, getTransport, type ScheduledEmailKind } from "./_email";

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

function normalizeKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function resolveCategory(evento: FirebaseFirestore.DocumentData, rawCategory?: unknown, publicOnly = false) {
  const categories = Array.isArray(evento.categoriasInscricao) ? evento.categoriasInscricao : [];
  const active = categories.filter((category) => category?.ativa !== false && (!publicOnly || category?.publica !== false));
  if (active.length === 0) return null;
  const key = normalizeKey(rawCategory);
  if (!key) return active.find((category) => category.publica !== false) || active[0];
  return active.find((category) => normalizeKey(category.id) === key || normalizeKey(category.nome) === key) || null;
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

export async function resolveSignupStatusWithCategory(db: FirebaseFirestore.Firestore, evento: FirebaseFirestore.DocumentData, eventoId: string, rawCategory?: unknown, publicOnly = false): Promise<{
  statusInscricao: "confirmado" | "espera";
  categoriaInscricao: { id: string; nome: string; tipo: "gratuito" | "pago" } | null;
}> {
  const category = resolveCategory(evento, rawCategory, publicOnly);
  if (!category) {
    return {
      statusInscricao: await resolveSignupStatus(db, evento, eventoId) as "confirmado" | "espera",
      categoriaInscricao: null,
    };
  }

  const capacidade = Number(category.capacidade || 0);
  if (!capacidade) {
    return {
      statusInscricao: "confirmado" as const,
      categoriaInscricao: { id: String(category.id), nome: String(category.nome), tipo: category.tipo === "pago" ? "pago" as const : "gratuito" as const },
    };
  }

  const snap = await db.collection("inscricoes").where("eventoId", "==", eventoId).where("categoriaInscricao.id", "==", String(category.id)).get();
  const confirmed = snap.docs.filter((doc) => doc.data().statusInscricao !== "espera").length;
  if (confirmed < capacidade) {
    return {
      statusInscricao: "confirmado" as const,
      categoriaInscricao: { id: String(category.id), nome: String(category.nome), tipo: category.tipo === "pago" ? "pago" as const : "gratuito" as const },
    };
  }
  if (category.listaEsperaAtiva === false) throw new Error(`Categoria ${category.nome} lotada`);
  return {
    statusInscricao: "espera" as const,
    categoriaInscricao: { id: String(category.id), nome: String(category.nome), tipo: category.tipo === "pago" ? "pago" as const : "gratuito" as const },
  };
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
      subject: inviteEmail.subject,
      html: inviteEmail.html,
      attachments: inviteEmail.attachments,
    });

    await inscricaoRef.update({
      emailEnviado: true,
      emailStatus: "enviado",
      emailErro: admin.firestore.FieldValue.delete(),
      emailEnviadoEm: admin.firestore.FieldValue.serverTimestamp(),
      "emailAgendados.convite.status": "enviado",
      "emailAgendados.convite.erro": admin.firestore.FieldValue.delete(),
      "emailAgendados.convite.enviadoEm": admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true as const, inscricaoId: inscricaoRef.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar convite";
    await inscricaoRef.update({
      emailEnviado: false,
      emailStatus: "falhou",
      emailErro: message,
      emailFalhouEm: admin.firestore.FieldValue.serverTimestamp(),
      "emailAgendados.convite.status": "falhou",
      "emailAgendados.convite.erro": message,
      "emailAgendados.convite.falhouEm": admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: false as const, inscricaoId: inscricaoRef.id, error: message };
  }
}

export async function sendScheduledEmail(
  db: FirebaseFirestore.Firestore,
  admin: typeof import("firebase-admin"),
  inscricaoRef: FirebaseFirestore.DocumentReference,
  kind: ScheduledEmailKind,
) {
  const inscricaoSnap = await inscricaoRef.get();
  if (!inscricaoSnap.exists) throw new Error("Inscrição não encontrada");

  const inscricao = { id: inscricaoSnap.id, ...inscricaoSnap.data()! } as FirebaseFirestore.DocumentData;
  if (inscricao.emailAgendados?.[kind]?.status === "enviado") {
    return { ok: true as const, skipped: true as const, inscricaoId: inscricaoRef.id };
  }

  const eventoSnap = await db.collection("eventos").doc(String(inscricao.eventoId)).get();
  if (!eventoSnap.exists) throw new Error("Evento não encontrado");
  const evento = { id: eventoSnap.id, ...eventoSnap.data()! } as FirebaseFirestore.DocumentData;

  try {
    await inscricaoRef.update({
      [`emailAgendados.${kind}.status`]: "pendente",
      [`emailAgendados.${kind}.erro`]: admin.firestore.FieldValue.delete(),
    });

    const email = await buildScheduledEmail(evento, inscricao, kind);
    await getTransport().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Sistema de Eventos"}" <${process.env.SMTP_USER}>`,
      to: String(inscricao.email),
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    });

    const update: Record<string, unknown> = {
      [`emailAgendados.${kind}.status`]: "enviado",
      [`emailAgendados.${kind}.erro`]: admin.firestore.FieldValue.delete(),
      [`emailAgendados.${kind}.enviadoEm`]: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (kind === "convite") {
      update.emailEnviado = true;
      update.emailStatus = "enviado";
      update.emailErro = admin.firestore.FieldValue.delete();
      update.emailEnviadoEm = admin.firestore.FieldValue.serverTimestamp();
    }
    await inscricaoRef.update(update);
    return { ok: true as const, inscricaoId: inscricaoRef.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar e-mail";
    const update: Record<string, unknown> = {
      [`emailAgendados.${kind}.status`]: "falhou",
      [`emailAgendados.${kind}.erro`]: message,
      [`emailAgendados.${kind}.falhouEm`]: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (kind === "convite") {
      update.emailEnviado = false;
      update.emailStatus = "falhou";
      update.emailErro = message;
      update.emailFalhouEm = admin.firestore.FieldValue.serverTimestamp();
    }
    await inscricaoRef.update(update);
    return { ok: false as const, inscricaoId: inscricaoRef.id, error: message };
  }
}
