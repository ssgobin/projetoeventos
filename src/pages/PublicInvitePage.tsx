import { CalendarDays, Download, MapPin, Share2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { formatDateTime } from "../lib/utils";
import { getFilePreview } from "../services/appwrite";
import { getPublicInvite } from "../services/email";
import type { Evento, Inscricao } from "../types";
import { getInviteRadius, normalizeInviteTheme } from "../utils/inviteTheme";

type PublicInviteData = {
  evento: Evento;
  inscricao: Inscricao;
};

export default function PublicInvitePage() {
  const { inscricaoId, token } = useParams();
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<PublicInviteData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!inscricaoId || !token) return;
    getPublicInvite(inscricaoId, token)
      .then((result) => setData(result as PublicInviteData))
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível abrir o convite."));
  }, [inscricaoId, token]);

  function downloadQr() {
    const url = qrRef.current?.toDataURL("image/png");
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `convite-${data?.inscricao.codigoConvite || "qrcode"}.png`;
    link.click();
  }

  async function shareInvite() {
    const url = location.href;
    if (navigator.share) {
      await navigator.share({ title: data?.evento.nome || "Convite", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-950">{error}</main>;
  }

  if (!data) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-950">Carregando convite...</main>;
  }

  const { evento, inscricao } = data;
  const theme = normalizeInviteTheme(evento.conviteTema, evento.corPrincipal);
  const radius = getInviteRadius(theme.shape);
  const logoSrc = evento.logoFileId ? getFilePreview(evento.logoFileId) : evento.logoUrl;
  const bannerSrc = evento.bannerFileId ? getFilePreview(evento.bannerFileId) : evento.bannerUrl;

  return (
    <main className="min-h-screen px-4 py-8" style={{ backgroundColor: theme.backgroundColor }}>
      <Card className="mx-auto max-w-3xl animate-fade-up overflow-hidden p-0" style={{ backgroundColor: theme.cardBackgroundColor, borderColor: theme.borderColor, borderRadius: radius }}>
        {theme.layout === "highlight" && <div className="h-3 w-full" style={{ backgroundColor: theme.accentColor }} />}
        {bannerSrc && <img src={bannerSrc} alt="" className="h-56 w-full object-cover" />}

        <div className="grid gap-8 p-6 md:grid-cols-[1fr_260px] md:p-8">
          <section>
            {logoSrc && <img src={logoSrc} alt="" className="mb-5 h-16 w-16 object-cover" style={{ borderRadius: Math.max(radius - 8, 4) }} />}
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.accentColor }}>{inscricao.statusInscricao === "espera" ? "Lista de espera" : "Convite confirmado"}</p>
            <h1 className="mt-2 text-3xl font-medium tracking-normal" style={{ color: theme.titleColor }}>{evento.nome}</h1>
            <p className="mt-3 text-sm leading-6" style={{ color: theme.textColor }}>{evento.mensagemConvite || evento.descricao}</p>

            <div className="mt-6 grid gap-3 text-sm" style={{ color: theme.textColor }}>
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" style={{ color: theme.accentColor }} />{formatDateTime(evento.dataEvento)}</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" style={{ color: theme.accentColor }} />{evento.local}</p>
            </div>

            <div className="mt-6 rounded-xl p-4 text-sm" style={{ backgroundColor: theme.detailsBackgroundColor, color: theme.textColor }}>
              <p><strong>Convidado:</strong> {String(inscricao.respostas.nome || inscricao.email)}</p>
              <p><strong>E-mail:</strong> {inscricao.email}</p>
              {inscricao.categoriaInscricao && <p><strong>Categoria:</strong> {inscricao.categoriaInscricao.nome}</p>}
              <p><strong>Status:</strong> {inscricao.statusInscricao === "espera" ? "Lista de espera" : inscricao.checkin?.realizado ? "Check-in realizado" : "Aguardando check-in"}</p>
            </div>
          </section>

          <aside className="text-center">
            <div className="mx-auto w-fit p-3 ring-1" style={{ backgroundColor: theme.qrBackgroundColor, borderColor: theme.borderColor, borderRadius: Math.max(radius - 6, 4) }}>
              <QRCodeCanvas ref={qrRef} value={inscricao.qrToken} size={200} />
            </div>
            <p className="mt-4 px-4 py-3 font-mono text-lg tracking-widest" style={{ backgroundColor: theme.codeBackgroundColor, color: theme.codeTextColor, borderRadius: Math.max(radius - 8, 4) }}>{inscricao.codigoConvite}</p>
            <div className="mt-4 grid gap-2">
              <Button style={{ backgroundColor: theme.buttonBackgroundColor, color: theme.buttonTextColor }} onClick={downloadQr}><Download className="h-4 w-4" />Baixar QR Code</Button>
              <Button variant="secondary" onClick={shareInvite}><Share2 className="h-4 w-4" />Compartilhar</Button>
            </div>
          </aside>
        </div>
      </Card>
    </main>
  );
}
