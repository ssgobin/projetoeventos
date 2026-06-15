import nodemailer from "nodemailer";
import QRCode from "qrcode";

export type ScheduledEmailKind = "convite" | "lembrete24h" | "lembreteDia" | "posEvento";

const DEFAULT_INVITE_THEME = {
  layout: "classic",
  shape: "soft",
  backgroundColor: "#f5f7fb",
  cardBackgroundColor: "#ffffff",
  accentColor: "#5b21b6",
  titleColor: "#111827",
  textColor: "#4b5563",
  mutedTextColor: "#6b7280",
  borderColor: "#e5e7eb",
  detailsBackgroundColor: "#f8fafc",
  codeBackgroundColor: "#111827",
  codeTextColor: "#ffffff",
  qrBackgroundColor: "#ffffff",
  buttonBackgroundColor: "#111827",
  buttonTextColor: "#ffffff",
};

function normalizeInviteTheme(theme: Record<string, unknown> | undefined, fallbackAccent: string) {
  return {
    ...DEFAULT_INVITE_THEME,
    accentColor: fallbackAccent || DEFAULT_INVITE_THEME.accentColor,
    buttonBackgroundColor: fallbackAccent || DEFAULT_INVITE_THEME.buttonBackgroundColor,
    ...(theme || {}),
  };
}

function getInviteRadius(shape: unknown) {
  if (shape === "straight") return 6;
  if (shape === "pill") return 28;
  return 18;
}

function absoluteAssetUrl(url?: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || "";
  return siteUrl ? `${siteUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}` : url;
}

function inviteUrl(inscricao: FirebaseFirestore.DocumentData) {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || "";
  if (!siteUrl || !inscricao.id || !inscricao.qrToken) return "";
  return `${siteUrl.replace(/\/$/, "")}/convite/${encodeURIComponent(String(inscricao.id))}/${encodeURIComponent(String(inscricao.qrToken))}`;
}

function defaultMessage(kind: ScheduledEmailKind, evento: FirebaseFirestore.DocumentData, isWaitlist: boolean) {
  if (isWaitlist) return "Sua inscrição foi recebida e está na lista de espera. Avisaremos quando uma vaga for liberada.";
  if (kind === "lembrete24h") return evento.emailAgenda?.mensagemLembrete24h || "Seu evento acontece amanhã. Guarde seu QR Code e confira data, horário e local.";
  if (kind === "lembreteDia") return evento.emailAgenda?.mensagemLembreteDia || "É hoje! Apresente seu QR Code na entrada para agilizar o check-in.";
  if (kind === "posEvento") return evento.emailAgenda?.mensagemPosEvento || "Obrigado pela presença. Foi um prazer receber você neste evento.";
  return evento.mensagemConvite || "";
}

function emailMeta(kind: ScheduledEmailKind, evento: FirebaseFirestore.DocumentData, isWaitlist: boolean) {
  if (isWaitlist) {
    return {
      eyebrow: "Lista de espera",
      subject: `Inscrição em lista de espera - ${evento.nome}`,
      includeQr: true,
    };
  }
  if (kind === "lembrete24h") {
    return {
      eyebrow: "Lembrete 24h",
      subject: `Lembrete: ${evento.nome} acontece amanhã`,
      includeQr: true,
    };
  }
  if (kind === "lembreteDia") {
    return {
      eyebrow: "É hoje",
      subject: `Hoje é o dia: ${evento.nome}`,
      includeQr: true,
    };
  }
  if (kind === "posEvento") {
    return {
      eyebrow: "Obrigado pela presença",
      subject: `Obrigado por participar - ${evento.nome}`,
      includeQr: false,
    };
  }
  return {
    eyebrow: "Convite confirmado",
    subject: `Seu convite - ${evento.nome}`,
    includeQr: true,
  };
}

export async function buildScheduledEmail(evento: FirebaseFirestore.DocumentData, inscricao: FirebaseFirestore.DocumentData, kind: ScheduledEmailKind) {
  const qrCid = `qrcode-${kind}-${inscricao.codigoConvite}@projetoeventos`;
  const qrBuffer = await QRCode.toBuffer(inscricao.qrToken, { width: 220, margin: 1 });
  const date = evento.dataEvento?.toDate?.() ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(evento.dataEvento.toDate()) : "";
  const nome = inscricao.respostas?.nome || inscricao.email;
  const theme = normalizeInviteTheme(evento.conviteTema, evento.corPrincipal);
  const isWaitlist = inscricao.statusInscricao === "espera";
  const meta = emailMeta(kind, evento, isWaitlist);
  const radius = getInviteRadius(theme.shape);
  const innerRadius = Math.max(radius - 4, 4);
  const compact = theme.layout === "compact";
  const contentPadding = compact ? 24 : 32;
  const bannerUrl = absoluteAssetUrl(evento.bannerUrl);
  const logoUrl = absoluteAssetUrl(evento.logoUrl);
  const publicInviteUrl = inviteUrl(inscricao);
  const message = defaultMessage(kind, evento, isWaitlist);
  const qrBlock = meta.includeQr ? `
        <div style="text-align:center">
          <img src="cid:${qrCid}" alt="QR Code" width="220" height="220" style="display:block;margin:0 auto 12px;border:1px solid ${theme.borderColor};background:${theme.qrBackgroundColor};border-radius:${innerRadius}px;padding:10px">
          <p style="margin:0 auto;font-family:monospace;font-size:22px;letter-spacing:6px;background:${theme.codeBackgroundColor};color:${theme.codeTextColor};border-radius:${innerRadius}px;padding:14px 18px;display:inline-block">${inscricao.codigoConvite}</p>
          ${publicInviteUrl ? `<p style="margin:18px 0 0"><a href="${publicInviteUrl}" style="background:${theme.buttonBackgroundColor};color:${theme.buttonTextColor};text-decoration:none;border-radius:${innerRadius}px;padding:13px 18px;display:inline-block;font-weight:700">Abrir convite</a></p>` : ""}
        </div>
        <p style="margin-top:24px;color:${theme.mutedTextColor};font-size:13px">Apresente este QR Code na entrada. O check-in só é confirmado por um operador autenticado.</p>` : "";

  const html = `
  <div style="margin:0;background:${theme.backgroundColor};padding:32px;font-family:Montserrat,Arial,sans-serif;color:${theme.titleColor}">
    <div style="max-width:640px;margin:auto;background:${theme.cardBackgroundColor};border-radius:${radius}px;overflow:hidden;border:1px solid ${theme.borderColor}">
      ${theme.layout === "highlight" ? `<div style="height:12px;background:${theme.accentColor}"></div>` : ""}
      ${bannerUrl ? `<img src="${bannerUrl}" alt="" style="width:100%;height:220px;object-fit:cover;display:block">` : ""}
      <div style="padding:${contentPadding}px">
        ${logoUrl ? `<img src="${logoUrl}" alt="" style="width:64px;height:64px;border-radius:${innerRadius}px;object-fit:cover">` : ""}
        <p style="color:${theme.accentColor};font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">${meta.eyebrow}</p>
        <h1 style="margin:8px 0 0;font-size:${compact ? 26 : 30}px;line-height:1.15;color:${theme.titleColor}">${evento.nome}</h1>
        <p style="font-size:16px;color:${theme.textColor}">${message}</p>
        <div style="margin:24px 0;padding:18px;border-radius:${innerRadius}px;background:${theme.detailsBackgroundColor};color:${theme.textColor}">
          <p><strong>Convidado:</strong> ${nome}</p>
          <p><strong>Data:</strong> ${date}</p>
          <p><strong>Local:</strong> ${evento.local}</p>
        </div>
        ${qrBlock}
      </div>
    </div>
  </div>`;

  return {
    subject: meta.subject,
    html,
    attachments: meta.includeQr ? [
      {
        filename: "qrcode.png",
        content: qrBuffer,
        contentType: "image/png",
        cid: qrCid,
      },
    ] : [],
  };
}

export function buildInviteEmail(evento: FirebaseFirestore.DocumentData, inscricao: FirebaseFirestore.DocumentData) {
  return buildScheduledEmail(evento, inscricao, "convite");
}

export function getTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
