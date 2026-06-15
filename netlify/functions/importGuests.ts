import { assertSameCompany, errorStatus, getAdmin, getAuthedUser, getAuthHeader, response } from "./_admin";
import { isEmail, makeInviteCode, makeSignupId, makeToken, normalizeEmail, resolveSignupStatusWithCategory, sanitizeImportValue, sendInvite } from "./_invite";

type ImportRow = Record<string, unknown>;

function pickEmail(row: ImportRow) {
  return normalizeEmail(row.email ?? row["e-mail"] ?? row.Email ?? row["E-mail"] ?? row.EMAIL);
}

function pickName(row: ImportRow) {
  return sanitizeImportValue(row.nome ?? row.Nome ?? row.name ?? row.Name ?? row["nome completo"] ?? row["Nome completo"]);
}

function pickCategory(row: ImportRow) {
  return sanitizeImportValue(row.categoria ?? row.Categoria ?? row.lote ?? row.Lote ?? row.tipo ?? row.Tipo ?? row.credencial ?? row.Credencial);
}

function normalizeResponses(row: ImportRow, email: string) {
  const respostas: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = sanitizeImportValue(key);
    if (!cleanKey) continue;
    const lower = cleanKey.toLowerCase();
    if (["email", "e-mail"].includes(lower)) continue;
    respostas[cleanKey] = sanitizeImportValue(value);
  }
  if (!respostas.nome) respostas.nome = pickName(row) || email;
  respostas.email = email;
  return respostas;
}

export async function handler(event: { body?: string; headers: Record<string, string | undefined> }) {
  try {
    const auth = await getAuthedUser(getAuthHeader(event.headers));
    const { eventoId, rows, sendEmails } = JSON.parse(event.body || "{}") as { eventoId?: string; rows?: ImportRow[]; sendEmails?: boolean };
    if (!eventoId) return response(400, { error: "eventoId obrigatório" });
    if (!Array.isArray(rows) || rows.length === 0) return response(400, { error: "Envie ao menos uma linha para importar." });
    if (rows.length > 300) return response(400, { error: "Importe no máximo 300 convidados por vez." });

    const admin = getAdmin();
    const db = admin.firestore();
    const eventoRef = db.collection("eventos").doc(eventoId);
    const eventoSnap = await eventoRef.get();
    if (!eventoSnap.exists) return response(404, { error: "Evento não encontrado" });
    const evento = eventoSnap.data()!;
    assertSameCompany(auth.usuario, evento.empresaId);

    const createdIds: string[] = [];
    const skipped: Array<{ row: number; email?: string; reason: string }> = [];
    const seen = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const email = pickEmail(row);
      if (!isEmail(email)) {
        skipped.push({ row: rowNumber, email, reason: "E-mail inválido" });
        continue;
      }
      if (seen.has(email)) {
        skipped.push({ row: rowNumber, email, reason: "E-mail duplicado na planilha" });
        continue;
      }
      seen.add(email);

      const inscricaoRef = evento.permitirDuplicidadeEmail
        ? db.collection("inscricoes").doc()
        : db.collection("inscricoes").doc(makeSignupId(eventoId, email));

      if (!evento.permitirDuplicidadeEmail && (await inscricaoRef.get()).exists) {
        skipped.push({ row: rowNumber, email, reason: "E-mail já inscrito no evento" });
        continue;
      }

      let statusInscricao: "confirmado" | "espera";
      let categoriaInscricao: Awaited<ReturnType<typeof resolveSignupStatusWithCategory>>["categoriaInscricao"];
      try {
        const status = await resolveSignupStatusWithCategory(db, evento, eventoId, pickCategory(row), false);
        statusInscricao = status.statusInscricao;
        categoriaInscricao = status.categoriaInscricao;
      } catch (error) {
        skipped.push({ row: rowNumber, email, reason: error instanceof Error ? error.message : "Evento lotado" });
        continue;
      }

      await inscricaoRef.set({
        empresaId: evento.empresaId,
        eventoId,
        email,
        respostas: normalizeResponses(row, email),
        arquivos: [],
        qrToken: makeToken(),
        codigoConvite: makeInviteCode(),
        ...(categoriaInscricao ? { categoriaInscricao } : {}),
        statusInscricao,
        checkin: { realizado: false },
        emailEnviado: false,
        emailStatus: "pendente",
        origem: "importacao",
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      createdIds.push(inscricaoRef.id);
    }

    const sent = [];
    const failed = [];
    if (sendEmails) {
      for (const inscricaoId of createdIds) {
        const result = await sendInvite(db, admin, db.collection("inscricoes").doc(inscricaoId));
        if (result.ok) sent.push(inscricaoId);
        else failed.push({ inscricaoId, error: result.error });
      }
    }

    await db.collection("logs").add({
      empresaId: evento.empresaId,
      usuarioId: auth.uid,
      acao: "inscritos_importados",
      detalhes: { eventoId, criados: createdIds.length, ignorados: skipped.length, emailsEnviados: sent.length, emailsFalharam: failed.length },
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
    });

    return response(200, { createdIds, skipped, sent, failed });
  } catch (err) {
    return response(errorStatus(err), { error: err instanceof Error ? err.message : "Falha na importação" });
  }
}
