import { assertSameCompany, errorStatus, getAdmin, getAuthedUser, getAuthHeader, response } from "./_admin";

export async function handler(event: { body?: string; headers: Record<string, string | undefined> }) {
  try {
    const auth = await getAuthedUser(getAuthHeader(event.headers));
    const body = JSON.parse(event.body || "{}");
    const admin = getAdmin();
    const db = admin.firestore();

    if (body.confirmar && body.inscricaoId) {
      const ref = db.collection("inscricoes").doc(body.inscricaoId);
      const snap = await ref.get();
      if (!snap.exists) return response(404, { error: "Inscricao nao encontrada" });
      const inscricao = snap.data()!;
      assertSameCompany(auth.usuario, inscricao.empresaId);
      await ref.update({
        checkin: {
          realizado: true,
          dataHora: admin.firestore.FieldValue.serverTimestamp(),
          operadorId: auth.uid,
        },
      });
      await db.collection("checkins").add({
        empresaId: inscricao.empresaId,
        eventoId: inscricao.eventoId,
        inscricaoId: snap.id,
        operadorId: auth.uid,
        dataHora: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection("logs").add({
        empresaId: inscricao.empresaId,
        usuarioId: auth.uid,
        acao: "checkin_confirmado",
        detalhes: { inscricaoId: snap.id },
        dataHora: admin.firestore.FieldValue.serverTimestamp(),
      });
      return response(200, { ok: true });
    }

    const qrToken = String(body.qrToken || "").trim();
    const eventoId = String(body.eventoId || "").trim();
    if (!qrToken || !eventoId) return response(400, { error: "Token e evento obrigatorios" });
    const snap = await db.collection("inscricoes").where("qrToken", "==", qrToken).limit(1).get();
    if (snap.empty) return response(200, { status: "invalido" });
    const doc = snap.docs[0];
    const inscricao: FirebaseFirestore.DocumentData = { id: doc.id, ...doc.data() };
    assertSameCompany(auth.usuario, inscricao.empresaId);
    if (inscricao.eventoId !== eventoId) return response(200, { status: "evento_incorreto", inscricao });
    if (inscricao.checkin?.realizado) return response(200, { status: "ja_realizado", inscricao });
    return response(200, { status: "valido", inscricao });
  } catch (err) {
    return response(errorStatus(err), { error: err instanceof Error ? err.message : "Falha na validacao" });
  }
}
