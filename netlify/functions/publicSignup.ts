import { getAdmin, response } from "./_admin";
import { isEmail, makeInviteCode, makeSignupId, makeToken, normalizeEmail, resolveSignupStatusWithCategory, sanitizeImportValue } from "./_invite";

type SignupBody = {
  eventoId?: string;
  email?: string;
  categoriaId?: string;
  respostas?: Record<string, unknown>;
  arquivos?: Array<{ campoId: string; fileId: string; url: string; nome: string }>;
};

export async function handler(event: { body?: string }) {
  try {
    const { eventoId, email: rawEmail, categoriaId, respostas = {}, arquivos = [] } = JSON.parse(event.body || "{}") as SignupBody;
    if (!eventoId) return response(400, { error: "eventoId obrigatório" });
    const email = normalizeEmail(rawEmail);
    if (!isEmail(email)) return response(400, { error: "Informe um e-mail válido." });

    const admin = getAdmin();
    const db = admin.firestore();
    const [eventoSnap, formularioSnap] = await Promise.all([
      db.collection("eventos").doc(eventoId).get(),
      db.collection("formularios").doc(eventoId).get(),
    ]);
    if (!eventoSnap.exists || eventoSnap.data()?.status !== "ativo") return response(404, { error: "Evento indisponível." });
    if (!formularioSnap.exists || formularioSnap.data()?.publicado !== true) return response(404, { error: "Formulário indisponível." });

    const evento = eventoSnap.data()!;
    const inscricaoRef = evento.permitirDuplicidadeEmail
      ? db.collection("inscricoes").doc()
      : db.collection("inscricoes").doc(makeSignupId(eventoId, email));

    if (!evento.permitirDuplicidadeEmail && (await inscricaoRef.get()).exists) {
      return response(409, { error: "Este e-mail já está inscrito neste evento." });
    }

    const { statusInscricao, categoriaInscricao } = await resolveSignupStatusWithCategory(db, evento, eventoId, categoriaId || respostas.categoria, true);
    const qrToken = makeToken();
    const codigoConvite = makeInviteCode();
    const cleanResponses = Object.fromEntries(Object.entries(respostas).map(([key, value]) => [key, typeof value === "string" ? sanitizeImportValue(value) : value]));
    cleanResponses.email = email;
    if (categoriaInscricao) cleanResponses.categoria = categoriaInscricao.nome;

    await inscricaoRef.set({
      empresaId: evento.empresaId,
      eventoId,
      email,
      respostas: cleanResponses,
      arquivos,
      qrToken,
      codigoConvite,
      ...(categoriaInscricao ? { categoriaInscricao } : {}),
      statusInscricao,
      checkin: { realizado: false },
      emailEnviado: false,
      emailStatus: "pendente",
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("logs").add({
      empresaId: evento.empresaId,
      usuarioId: "public-form",
      acao: statusInscricao === "espera" ? "inscricao_lista_espera" : "inscricao_confirmada",
      detalhes: { eventoId, inscricaoId: inscricaoRef.id, categoria: categoriaInscricao?.nome || null },
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
    });

    return response(200, { inscricaoId: inscricaoRef.id, qrToken, codigoConvite, statusInscricao, categoriaInscricao });
  } catch (err) {
    return response(err instanceof Error && err.message.includes("lotad") ? 409 : 500, { error: err instanceof Error ? err.message : "Não foi possível concluir a inscrição." });
  }
}
