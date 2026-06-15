import { doc, getDoc } from "firebase/firestore";
import { CalendarDays, CheckCircle2, ClipboardList, MapPin, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { formatDateTime } from "../lib/utils";
import { getFilePreview } from "../services/appwrite";
import { db } from "../services/firebase";
import type { Evento, Formulario, PaginaEvento } from "../types";

function fallbackPage(event: Evento): Partial<PaginaEvento> {
  return {
    publicada: true,
    eyebrow: "Inscrições abertas",
    titulo: event.nome,
    subtitulo: event.descricao,
    ctaPrincipal: "Garantir inscrição",
    ctaSecundario: "Ver detalhes",
    sobreTitulo: "Tudo pronto para receber sua inscrição",
    sobreTexto: event.descricao,
    cardTitulo: "Confirme sua presença",
    cardTexto: "Preencha o formulário público para receber seu convite com código e QR Code de acesso.",
    mostrarData: true,
    mostrarLocal: true,
    mostrarLogo: true,
    mostrarProgramacao: false,
    programacao: [],
    mostrarFaq: false,
    faq: [],
  };
}

export default function PublicEventPage() {
  const { eventoId } = useParams();
  const [event, setEvent] = useState<Evento | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [page, setPage] = useState<Partial<PaginaEvento> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventoId) return;
    let cancelled = false;
    Promise.all([
      getDoc(doc(db, "eventos", eventoId)),
      getDoc(doc(db, "formularios", eventoId)),
      getDoc(doc(db, "paginasEvento", eventoId)),
    ])
      .then(([eventSnap, formSnap, pageSnap]) => {
        if (cancelled) return;
        if (!eventSnap.exists()) {
          setError("Evento não encontrado.");
          return;
        }
        const eventData = { id: eventSnap.id, ...eventSnap.data() } as Evento;
        setEvent(eventData);
        setFormulario(formSnap.exists() ? ({ id: formSnap.id, ...formSnap.data() } as Formulario) : null);
        setPage({ ...fallbackPage(eventData), ...(pageSnap.exists() ? pageSnap.data() as PaginaEvento : {}) });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível abrir o evento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventoId]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-950">Carregando evento...</main>;
  }

  if (error || !event || !page) {
    return <Unavailable title="Evento indisponível" description={error || "Não encontramos este evento."} />;
  }

  if (event.status !== "ativo" || !formulario?.publicado || page.publicada === false) {
    return <Unavailable title="Inscrições indisponíveis" description="Este evento ainda não está recebendo inscrições públicas." />;
  }

  const bannerSrc = event.bannerFileId ? getFilePreview(event.bannerFileId) : event.bannerUrl;
  const logoSrc = event.logoFileId ? getFilePreview(event.logoFileId) : event.logoUrl;
  const formLink = `/form/${event.id}`;
  const accent = event.corPrincipal || "#5b21b6";
  const programacao = page.mostrarProgramacao ? (page.programacao || []).filter((item) => item.titulo || item.horario) : [];
  const faq = page.mostrarFaq ? (page.faq || []).filter((item) => item.pergunta || item.resposta) : [];

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative min-h-[88vh] overflow-hidden">
        {bannerSrc ? (
          <img src={bannerSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/62 to-slate-950/92" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {page.mostrarLogo !== false && logoSrc ? (
                <img src={logoSrc} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/35" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-white/14 text-white ring-1 ring-white/30">
                  <CalendarDays className="h-5 w-5" />
                </div>
              )}
              <span className="text-sm font-medium text-white/85">EventOS</span>
            </div>
            <Button asChild variant="secondary">
              <Link to={formLink}>{page.ctaPrincipal || "Inscrever-se"}</Link>
            </Button>
          </header>

          <div className="max-w-3xl pb-10 pt-20">
            {page.eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">{page.eyebrow}</p>}
            <h1 className="mt-4 text-4xl font-medium leading-tight tracking-normal text-white sm:text-6xl">{page.titulo || event.nome}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">{page.subtitulo || event.descricao}</p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm text-white/86">
              {page.mostrarData !== false && (
                <span className="inline-flex items-center gap-2 rounded-md bg-white/12 px-3 py-2 ring-1 ring-white/18">
                  <CalendarDays className="h-4 w-4" />{formatDateTime(event.dataEvento)}
                </span>
              )}
              {page.mostrarLocal !== false && (
                <span className="inline-flex items-center gap-2 rounded-md bg-white/12 px-3 py-2 ring-1 ring-white/18">
                  <MapPin className="h-4 w-4" />{event.local}
                </span>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild style={{ backgroundColor: accent, color: "#ffffff" }}>
                <Link to={formLink}>{page.ctaPrincipal || "Garantir inscrição"}</Link>
              </Button>
              <Button asChild variant="secondary">
                <a href="#detalhes">{page.ctaSecundario || "Ver detalhes"}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="detalhes" className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div>
          <p className="page-kicker">Sobre o evento</p>
          <h2 className="mt-2 text-3xl font-medium tracking-normal text-slate-950">{page.sobreTitulo}</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600">{page.sobreTexto}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {page.mostrarData !== false && <Info icon={CalendarDays} label="Data e horário" value={formatDateTime(event.dataEvento)} />}
            {page.mostrarLocal !== false && <Info icon={MapPin} label="Local" value={event.local} />}
          </div>
        </div>

        <Card className="self-start">
          <p className="text-sm font-medium text-slate-500">Inscrição</p>
          <h3 className="mt-2 text-2xl font-medium tracking-normal">{page.cardTitulo}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-950/62">{page.cardTexto}</p>
          <div className="mt-5 space-y-3 text-sm text-slate-950/70">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Confirmação por e-mail</p>
            <p className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-indigo-600" />Convite individual com QR Code</p>
          </div>
          <Button asChild className="mt-6 w-full" style={{ backgroundColor: accent, color: "#ffffff" }}>
            <Link to={formLink}>{page.ctaPrincipal || "Preencher inscrição"}</Link>
          </Button>
        </Card>
      </section>

      {programacao.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8 lg:px-10">
          <p className="page-kicker">Programação</p>
          <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {programacao.map((item) => (
              <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[140px_1fr]">
                <p className="font-medium text-indigo-600">{item.horario}</p>
                <div>
                  <h3 className="font-medium text-slate-950">{item.titulo}</h3>
                  {item.descricao && <p className="mt-1 text-sm leading-6 text-slate-950/62">{item.descricao}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8 lg:px-10">
          <p className="page-kicker">Dúvidas frequentes</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {faq.map((item) => (
              <Card key={item.id}>
                <h3 className="font-medium text-slate-950">{item.pergunta}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-950/62">{item.resposta}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-5 w-5 text-indigo-600" />
      <p className="mt-3 text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center text-slate-950">
      <div>
        <h1 className="text-3xl font-medium tracking-normal">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-950/62">{description}</p>
      </div>
    </main>
  );
}
