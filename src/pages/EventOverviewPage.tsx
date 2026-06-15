import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { CalendarDays, CheckCircle2, ClipboardList, Copy, Edit, ExternalLink, Globe2, Mail, MapPin, QrCode, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { ErrorState } from "../components/ui/state";
import { useFeedback } from "../contexts/FeedbackContext";
import { formatDateTime } from "../lib/utils";
import { getFilePreview } from "../services/appwrite";
import { db } from "../services/firebase";
import type { Evento, Formulario, Inscricao } from "../types";

const quickActions = [
  { label: "Editar evento", icon: Edit, to: (id: string) => `/eventos/${id}` },
  { label: "Formulário", icon: ClipboardList, to: (id: string) => `/eventos/${id}/formulario` },
  { label: "Página pública", icon: Globe2, to: (id: string) => `/eventos/${id}/pagina` },
  { label: "Convite", icon: Mail, to: (id: string) => `/eventos/${id}/convite` },
  { label: "Inscritos", icon: Users, to: (id: string) => `/eventos/${id}/inscritos` },
  { label: "Check-in", icon: QrCode, to: (id: string) => `/eventos/${id}/checkin` },
];

export default function EventOverviewPage() {
  const { eventoId } = useParams();
  const { notify } = useFeedback();
  const [event, setEvent] = useState<Evento | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [recentGuests, setRecentGuests] = useState<Inscricao[]>([]);
  const [stats, setStats] = useState({ inscritos: 0, espera: 0, checkins: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventoId) return;
    let cancelled = false;
    const eventRef = doc(db, "eventos", eventoId);
    const formRef = doc(db, "formularios", eventoId);
    const guestsBase = collection(db, "inscricoes");

    Promise.all([
      getDoc(eventRef),
      getDoc(formRef),
      getDocs(query(guestsBase, where("eventoId", "==", eventoId), orderBy("criadoEm", "desc"), limit(6))),
      getCountFromServer(query(guestsBase, where("eventoId", "==", eventoId))),
      getCountFromServer(query(guestsBase, where("eventoId", "==", eventoId), where("statusInscricao", "==", "espera"))),
      getCountFromServer(query(guestsBase, where("eventoId", "==", eventoId), where("checkin.realizado", "==", true))),
    ]).then(([eventSnap, formSnap, guestSnap, totalCount, waitlistCount, checkinCount]) => {
      if (cancelled) return;
      if (!eventSnap.exists()) {
        setError("Evento não encontrado.");
        return;
      }
      setEvent({ id: eventSnap.id, ...eventSnap.data() } as Evento);
      setFormulario(formSnap.exists() ? ({ id: formSnap.id, ...formSnap.data() } as Formulario) : null);
      setRecentGuests(guestSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as Inscricao));
      setStats({
        inscritos: totalCount.data().count,
        espera: waitlistCount.data().count,
        checkins: checkinCount.data().count,
      });
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar a visão geral.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [eventoId]);

  const publicLink = eventoId ? `${location.origin}/evento/${eventoId}` : "";
  const formLink = eventoId ? `${location.origin}/form/${eventoId}` : "";
  const confirmed = Math.max(0, stats.inscritos - stats.espera);
  const attendanceRate = confirmed ? Math.round((stats.checkins / confirmed) * 100) : 0;
  const capacityRate = event?.capacidade ? Math.min(100, Math.round((confirmed / event.capacidade) * 100)) : 0;
  const heroImage = event?.bannerFileId ? getFilePreview(event.bannerFileId) : event?.bannerUrl;
  const formStatus = formulario?.publicado ? "Publicado" : "Rascunho";

  const checklist = useMemo(() => {
    if (!event) return [];
    return [
      { label: "Evento ativo", done: event.status === "ativo" },
      { label: "Formulário publicado", done: Boolean(formulario?.publicado) },
      { label: "Convite configurado", done: Boolean(event.mensagemConvite && event.mensagemSucesso) },
      { label: "Com inscritos", done: stats.inscritos > 0 },
    ];
  }, [event, formulario?.publicado, stats.inscritos]);

  function copyPublicLink() {
    navigator.clipboard.writeText(publicLink);
    notify({ type: "success", title: "Link copiado", description: "O link público do evento está na área de transferência." });
  }

  if (error) return <ErrorState title="Visão geral indisponível" description={error} onRetry={() => location.reload()} />;
  if (!event || loading) return <p className="text-sm text-slate-500">Carregando visão geral...</p>;

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Visão geral</p>
          <h1 className="page-title">{event.nome}</h1>
          <p className="page-description">Resumo operacional do evento, status de publicação, inscrições, lista de espera e atalhos para gestão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copyPublicLink}><Copy className="h-4 w-4" />Copiar link</Button>
          <Button asChild><Link to={`/eventos/${event.id}/checkin`}><QrCode className="h-4 w-4" />Abrir check-in</Link></Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {heroImage && <img src={heroImage} alt="" className="h-56 w-full object-cover" />}
        <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={event.status === "ativo" ? "green" : event.status === "encerrado" ? "slate" : "amber"}>{event.status}</Badge>
              <Badge tone={formulario?.publicado ? "green" : "amber"}>{formStatus}</Badge>
              {event.capacidade ? <Badge tone={capacityRate >= 90 ? "amber" : "green"}>{confirmed}/{event.capacidade} vagas</Badge> : <Badge tone="slate">Vagas ilimitadas</Badge>}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{event.descricao}</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{formatDateTime(event.dataEvento)}</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{event.local}</p>
            </div>
          </div>
          <Button variant="secondary" asChild>
            <a href={publicLink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Abrir página pública</a>
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Inscritos" value={stats.inscritos} icon={Users} />
        <Metric label="Confirmados" value={confirmed} icon={CheckCircle2} />
        <Metric label="Lista de espera" value={stats.espera} icon={ClipboardList} />
        <Metric label="Check-ins" value={stats.checkins} icon={QrCode} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardTitle>Saúde do evento</CardTitle>
          <div className="mt-5 space-y-5">
            <Progress label="Presença" value={attendanceRate} detail={`${stats.checkins} check-ins de ${confirmed} confirmados`} />
            {event.capacidade ? <Progress label="Ocupação" value={capacityRate} detail={`${confirmed} vagas confirmadas de ${event.capacidade}`} /> : null}
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <Badge tone={item.done ? "green" : "amber"}>{item.done ? "ok" : "pendente"}</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Ações rápidas</CardTitle>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.to(event.id)} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-50 text-indigo-700 transition group-hover:bg-white">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-slate-950">{action.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase text-slate-400">Link público</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-950/70">{publicLink}</p>
            <p className="mt-3 text-xs font-medium uppercase text-slate-400">Formulário direto</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-950/70">{formLink}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Inscrições recentes</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link to={`/eventos/${event.id}/inscritos`}>Ver todos</Link></Button>
        </div>
        <div className="mt-5 space-y-3">
          {recentGuests.length === 0 ? (
            <EmptyState title="Nenhuma inscrição ainda" description="Quando alguém preencher o formulário, os últimos registros aparecerão aqui." />
          ) : (
            recentGuests.map((guest) => (
              <div key={guest.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-950">{String(guest.respostas.nome || guest.email)}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{guest.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {guest.categoriaInscricao && <Badge tone={guest.categoriaInscricao.tipo === "pago" ? "amber" : "slate"}>{guest.categoriaInscricao.nome}</Badge>}
                  <Badge tone={guest.statusInscricao === "espera" ? "amber" : "green"}>{guest.statusInscricao === "espera" ? "Lista de espera" : "Confirmado"}</Badge>
                  <Badge tone={guest.checkin.realizado ? "green" : "amber"}>{guest.checkin.realizado ? "Check-in" : "Pendente"}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-medium tracking-normal">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Progress({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-950">{label}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <p className="text-lg font-medium text-slate-950">{value}%</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-indigo-50">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
