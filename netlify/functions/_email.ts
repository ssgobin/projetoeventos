import nodemailer from "nodemailer";
import QRCode from "qrcode";

export async function buildInviteEmail(evento: FirebaseFirestore.DocumentData, inscricao: FirebaseFirestore.DocumentData) {
  const qrCid = `qrcode-${inscricao.codigoConvite}@projetoeventos`;
  const qrBuffer = await QRCode.toBuffer(inscricao.qrToken, { width: 220, margin: 1 });
  const date = evento.dataEvento?.toDate?.() ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(evento.dataEvento.toDate()) : "";
  const nome = inscricao.respostas?.nome || inscricao.email;
  const html = `
  <div style="margin:0;background:#f5f7fb;padding:32px;font-family:Inter,Arial,sans-serif;color:#111827">
    <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb">
      ${evento.bannerUrl ? `<img src="${evento.bannerUrl}" alt="" style="width:100%;height:220px;object-fit:cover;display:block">` : ""}
      <div style="padding:32px">
        ${evento.logoUrl ? `<img src="${evento.logoUrl}" alt="" style="width:64px;height:64px;border-radius:14px;object-fit:cover">` : ""}
        <p style="color:${evento.corPrincipal};font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">Convite confirmado</p>
        <h1 style="margin:8px 0 0;font-size:30px;line-height:1.15">${evento.nome}</h1>
        <p style="font-size:16px;color:#4b5563">${evento.mensagemConvite || ""}</p>
        <div style="margin:24px 0;padding:18px;border-radius:14px;background:#f8fafc">
          <p><strong>Convidado:</strong> ${nome}</p>
          <p><strong>Data:</strong> ${date}</p>
          <p><strong>Local:</strong> ${evento.local}</p>
        </div>
        <div style="text-align:center">
          <img src="cid:${qrCid}" alt="QR Code" width="220" height="220" style="display:block;margin:0 auto 12px;border:1px solid #e5e7eb;border-radius:16px;padding:10px">
          <p style="margin:0 auto;font-family:monospace;font-size:22px;letter-spacing:6px;background:#111827;color:white;border-radius:12px;padding:14px 18px;display:inline-block">${inscricao.codigoConvite}</p>
        </div>
        <p style="margin-top:24px;color:#6b7280;font-size:13px">Apresente este QR Code na entrada. O check-in so e confirmado por um operador autenticado.</p>
      </div>
    </div>
  </div>`;

  return {
    html,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrBuffer,
        contentType: "image/png",
        cid: qrCid,
      },
    ],
  };
}

export function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
