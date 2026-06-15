import { assertSameCompany, getAdmin, getAuthedUser, response } from "./_admin";

export async function handler(event: { body?: string; headers: Record<string, string | undefined> }) {
  try {
    const auth = await getAuthedUser(event.headers.authorization);
    const { eventoId } = JSON.parse(event.body || "{}");
    const admin = getAdmin();
    const db = admin.firestore();
    const eventoSnap = await db.collection("eventos").doc(eventoId).get();
    if (!eventoSnap.exists) return response(404, { error: "Evento não encontrado" });
    assertSameCompany(auth.usuario, eventoSnap.data()!.empresaId);
    const snap = await db.collection("inscricoes").where("eventoId", "==", eventoId).get();
    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, email: data.email, codigoConvite: data.codigoConvite, checkin: Boolean(data.checkin?.realizado), ...data.respostas };
    });
    await db.collection("logs").add({
      empresaId: eventoSnap.data()!.empresaId,
      usuarioId: auth.uid,
      acao: "inscritos_exportados",
      detalhes: { eventoId, total: rows.length },
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
    });
    return response(200, { rows });
  } catch (err) {
    return response(403, { error: err instanceof Error ? err.message : "Falha na exportação" });
  }
}
