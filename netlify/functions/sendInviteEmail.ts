import { getAdmin, response } from "./_admin";
import { sendInvite } from "./_invite";

export async function handler(event: { body?: string }) {
  try {
    const { inscricaoId } = JSON.parse(event.body || "{}");
    if (!inscricaoId) return response(400, { error: "inscricaoId obrigatório" });
    const admin = getAdmin();
    const db = admin.firestore();
    const inscricaoRef = db.collection("inscricoes").doc(inscricaoId);
    const inscricaoSnap = await inscricaoRef.get();
    if (!inscricaoSnap.exists) return response(404, { error: "Inscrição não encontrada" });
    const inscricao = inscricaoSnap.data()!;
    const eventoSnap = await db.collection("eventos").doc(inscricao.eventoId).get();
    if (!eventoSnap.exists) return response(404, { error: "Evento não encontrado" });
    const result = await sendInvite(db, admin, inscricaoRef);
    if (!result.ok) return response(500, { error: result.error });
    await db.collection("logs").add({
      empresaId: inscricao.empresaId,
      usuarioId: "public-form",
      acao: "email_convite_enviado",
      detalhes: { inscricaoId },
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
    });
    return response(200, { ok: true });
  } catch (err) {
    return response(500, { error: err instanceof Error ? err.message : "Erro ao enviar convite" });
  }
}
