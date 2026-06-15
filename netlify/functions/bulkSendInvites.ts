import { assertSameCompany, errorStatus, getAdmin, getAuthedUser, getAuthHeader, response } from "./_admin";
import { sendInvite } from "./_invite";

type BulkMode = "selected" | "pending" | "failed" | "all";

export async function handler(event: { body?: string; headers: Record<string, string | undefined> }) {
  try {
    const auth = await getAuthedUser(getAuthHeader(event.headers));
    const { eventoId, mode = "pending", inscricaoIds = [] } = JSON.parse(event.body || "{}") as {
      eventoId?: string;
      mode?: BulkMode;
      inscricaoIds?: string[];
    };
    if (!eventoId) return response(400, { error: "eventoId obrigatório" });

    const admin = getAdmin();
    const db = admin.firestore();
    const eventoSnap = await db.collection("eventos").doc(eventoId).get();
    if (!eventoSnap.exists) return response(404, { error: "Evento não encontrado" });
    const evento = eventoSnap.data()!;
    assertSameCompany(auth.usuario, evento.empresaId);

    let refs: FirebaseFirestore.DocumentReference[] = [];
    if (mode === "selected") {
      refs = inscricaoIds.slice(0, 300).map((id) => db.collection("inscricoes").doc(id));
    } else {
      let query: FirebaseFirestore.Query = db.collection("inscricoes").where("eventoId", "==", eventoId);
      if (mode === "pending") query = query.where("emailEnviado", "==", false);
      if (mode === "failed") query = query.where("emailStatus", "==", "falhou");
      const snap = await query.limit(300).get();
      refs = snap.docs.map((doc) => doc.ref);
    }

    const sent = [];
    const failed = [];
    for (const ref of refs) {
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.empresaId !== evento.empresaId || snap.data()?.eventoId !== eventoId) continue;
      const result = await sendInvite(db, admin, ref);
      if (result.ok) sent.push(ref.id);
      else failed.push({ inscricaoId: ref.id, error: result.error });
    }

    await db.collection("logs").add({
      empresaId: evento.empresaId,
      usuarioId: auth.uid,
      acao: "emails_convite_em_lote",
      detalhes: { eventoId, mode, solicitados: refs.length, enviados: sent.length, falhas: failed.length },
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
    });

    return response(200, { sent, failed, total: refs.length });
  } catch (err) {
    return response(errorStatus(err), { error: err instanceof Error ? err.message : "Falha no envio em lote" });
  }
}
