import { assertSameCompany, errorStatus, getAdmin, getAuthedUser, getAuthHeader, response } from "./_admin";
import { buildInviteHtml, getTransport } from "./_email";

export async function handler(event: { body?: string; headers: Record<string, string | undefined> }) {
  try {
    const auth = await getAuthedUser(getAuthHeader(event.headers));
    const { inscricaoId } = JSON.parse(event.body || "{}");
    const admin = getAdmin();
    const db = admin.firestore();
    const inscricaoRef = db.collection("inscricoes").doc(inscricaoId);
    const inscricaoSnap = await inscricaoRef.get();
    if (!inscricaoSnap.exists) return response(404, { error: "Inscricao nao encontrada" });
    const inscricao = inscricaoSnap.data()!;
    assertSameCompany(auth.usuario, inscricao.empresaId);
    const eventoSnap = await db.collection("eventos").doc(inscricao.eventoId).get();
    if (!eventoSnap.exists) return response(404, { error: "Evento nao encontrado" });
    const evento = eventoSnap.data()!;
    await getTransport().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Sistema de Eventos"}" <${process.env.SMTP_USER}>`,
      to: inscricao.email,
      subject: `Seu convite - ${evento.nome}`,
      html: await buildInviteHtml(evento, inscricao),
    });
    await inscricaoRef.update({ emailEnviado: true });
    await db.collection("logs").add({
      empresaId: inscricao.empresaId,
      usuarioId: auth.uid,
      acao: "email_convite_reenviado",
      detalhes: { inscricaoId },
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
    });
    return response(200, { ok: true });
  } catch (err) {
    return response(errorStatus(err), { error: err instanceof Error ? err.message : "Falha no reenvio" });
  }
}
