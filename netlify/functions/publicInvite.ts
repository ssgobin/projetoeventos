import { getAdmin, response } from "./_admin";

export async function handler(event: { queryStringParameters?: Record<string, string | undefined> }) {
  try {
    const inscricaoId = event.queryStringParameters?.inscricaoId;
    const token = event.queryStringParameters?.token;
    if (!inscricaoId || !token) return response(400, { error: "Convite inválido" });

    const admin = getAdmin();
    const db = admin.firestore();
    const inscricaoSnap = await db.collection("inscricoes").doc(inscricaoId).get();
    if (!inscricaoSnap.exists) return response(404, { error: "Convite não encontrado" });

    const inscricao = inscricaoSnap.data()!;
    if (inscricao.qrToken !== token) return response(403, { error: "Convite inválido" });

    const eventoSnap = await db.collection("eventos").doc(inscricao.eventoId).get();
    if (!eventoSnap.exists) return response(404, { error: "Evento não encontrado" });
    const evento = eventoSnap.data()!;

    const dataEvento = evento.dataEvento?.seconds ? { seconds: evento.dataEvento.seconds } : evento.dataEvento;

    return response(200, {
      inscricao: {
        id: inscricaoSnap.id,
        email: inscricao.email,
        respostas: inscricao.respostas || {},
        qrToken: inscricao.qrToken,
        codigoConvite: inscricao.codigoConvite,
        statusInscricao: inscricao.statusInscricao || "confirmado",
        checkin: inscricao.checkin || { realizado: false },
      },
      evento: {
        id: eventoSnap.id,
        nome: evento.nome,
        descricao: evento.descricao,
        local: evento.local,
        dataEvento,
        bannerUrl: evento.bannerUrl,
        bannerFileId: evento.bannerFileId,
        logoUrl: evento.logoUrl,
        logoFileId: evento.logoFileId,
        corPrincipal: evento.corPrincipal,
        mensagemConvite: evento.mensagemConvite,
        mensagemSucesso: evento.mensagemSucesso,
        conviteTema: evento.conviteTema,
      },
    });
  } catch (err) {
    return response(500, { error: err instanceof Error ? err.message : "Falha ao abrir convite" });
  }
}
