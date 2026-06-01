import { buildInviteEmail, getTransport } from "./_email";
import { getAdmin, response } from "./_admin";

export async function handler(event: { body?: string }) {
  try {
    const { inscricaoId } = JSON.parse(event.body || "{}");
    if (!inscricaoId) return response(400, { error: "inscricaoId obrigatorio" });
    const admin = getAdmin();
    const db = admin.firestore();
    const inscricaoRef = db.collection("inscricoes").doc(inscricaoId);
    const inscricaoSnap = await inscricaoRef.get();
    if (!inscricaoSnap.exists) return response(404, { error: "Inscricao nao encontrada" });
    const inscricao = inscricaoSnap.data()!;
    const eventoSnap = await db.collection("eventos").doc(inscricao.eventoId).get();
    if (!eventoSnap.exists) return response(404, { error: "Evento nao encontrado" });
    const evento = eventoSnap.data()!;
    const inviteEmail = await buildInviteEmail(evento, inscricao);
    await getTransport().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Sistema de Eventos"}" <${process.env.SMTP_USER}>`,
      to: inscricao.email,
      subject: `Convite confirmado - ${evento.nome}`,
      html: inviteEmail.html,
      attachments: inviteEmail.attachments,
    });
    await inscricaoRef.update({ emailEnviado: true });
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
