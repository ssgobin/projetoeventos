import { collection, doc, getDocs, orderBy, query, where, writeBatch } from "firebase/firestore";
import { ClipboardList, Copy, Edit, FileText, Loader2, Mail, MapPin, QrCode, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { formatDateTime } from "../lib/utils";
import { getFilePreview } from "../services/appwrite";
import { db } from "../services/firebase";
import type { Evento } from "../types";

const eventActions = [
  {
    to: (eventId: string) => `/eventos/${eventId}`,
    icon: Edit,
    title: "Dados do evento",
    description: "Nome, data, local e imagens",
  },
  {
    to: (eventId: string) => `/eventos/${eventId}/formulario`,
    icon: ClipboardList,
    title: "Formulario público",
    description: "Campos, tema e publicacao",
  },
  {
    to: (eventId: string) => `/eventos/${eventId}/convite`,
    icon: Mail,
    title: "Convite e e-mail",
    description: "Tela final, cores e mensagem",
  },
  {
    to: (eventId: string) => `/eventos/${eventId}/inscritos`,
    icon: Users,
    title: "Inscritos",
    description: "Lista, reenvio e exportacao",
  },
  {
    to: (eventId: string) => `/eventos/${eventId}/checkin`,
    icon: QrCode,
    title: "Check-in",
    description: "Validar QR Code na entrada",
  },
];

export default function EventsPage() {
  const { usuario } = useAuth();
  const { confirmAction, notify } = useFeedback();
  const [events, setEvents] = useState<Evento[]>([]);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  async function load() {
    if (!usuario) return;
    const filters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    const snap = await getDocs(query(collection(db, "eventos"), ...filters, orderBy("criadoEm", "desc")));
    setEvents(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Evento));
  }

  useEffect(() => {
    if (!usuario) return;
    const filters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    getDocs(query(collection(db, "eventos"), ...filters, orderBy("criadoEm", "desc"))).then((snap) => {
      setEvents(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Evento));
    });
  }, [usuario]);

  async function remove(event: Evento) {
    if (deletingEventId) return;
    const confirmed = await confirmAction({
      title: "Excluir evento?",
      description: `Você está prestes a excluir "${event.nome}". Todos os confirmados, dados de inscrição e o formulário deste evento serão apagados permanentemente.`,
      confirmLabel: "Excluir tudo",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingEventId(event.id);
    try {
      const inscricoesSnap = await getDocs(query(collection(db, "inscricoes"), where("eventoId", "==", event.id)));
      const refs = [
        ...inscricoesSnap.docs.map((item) => item.ref),
        doc(db, "formularios", event.id),
        doc(db, "eventos", event.id),
      ];

      for (let index = 0; index < refs.length; index += 450) {
        const batch = writeBatch(db);
        refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      await load();
      notify({ type: "success", title: "Evento excluído", description: `${inscricoesSnap.size} confirmado(s) foram apagados junto com o evento.` });
    } catch (error) {
      notify({ type: "error", title: "Falha ao excluir", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    } finally {
      setDeletingEventId(null);
    }
  }

  function copyPublicLink(event: Evento) {
    navigator.clipboard.writeText(`${location.origin}/form/${event.id}`);
    notify({ type: "success", title: "Link copiado", description: "O link público do formulário está na área de transferência." });
  }

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Eventos</p>
          <h1 className="page-title">Sua agenda de experiências</h1>
          <p className="page-description">Gerencie publicação, visual, formulários, inscritos e check-in com a organização de uma vitrine premium.</p>
        </div>
        <Button asChild><Link to="/eventos/novo">Criar evento</Link></Button>
      </div>

      {events.length === 0 ? (
        <EmptyState title="Nenhum evento cadastrado" description="Comece criando um evento com formulário público e identidade visual própria." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event, index) => (
            <Card key={event.id} className="animate-fade-up overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(76,29,149,0.12)]" style={{ animationDelay: `${index * 45}ms` }}>
              <div className="relative m-3 h-56 overflow-hidden rounded-xl bg-violet-100">
                {(event.bannerFileId || event.bannerUrl) ? (
                  <img src={event.bannerFileId ? getFilePreview(event.bannerFileId) : event.bannerUrl} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-violet-50 text-violet-700">
                    <FileText className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute right-3 top-3">
                  <Badge tone={event.status === "ativo" ? "green" : event.status === "encerrado" ? "slate" : "amber"}>{event.status}</Badge>
                </div>
              </div>

              <div className="space-y-4 px-5 pb-5 pt-2">
                <div>
                  <h2 className="line-clamp-1 text-lg font-medium tracking-normal">{event.nome}</h2>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-violet-950/60">{event.descricao}</p>
                </div>
                <div className="space-y-2 text-sm text-violet-950/65">
                  <p>{formatDateTime(event.dataEvento)}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-violet-400" />{event.local}</p>
                </div>
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-950/45">Gerenciar</p>
                  <div className="grid gap-2">
                    {eventActions.map((action) => (
                      <Link
                        key={action.title}
                        to={action.to(event.id)}
                        className="group flex items-center gap-3 rounded-lg border border-violet-100 bg-white px-3 py-2.5 text-left transition hover:border-violet-200 hover:bg-violet-50"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-800 transition group-hover:bg-white">
                          <action.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-violet-950">{action.title}</span>
                          <span className="block truncate text-xs text-violet-950/55">{action.description}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="grid gap-2 pt-2">
                    <Button size="sm" variant="secondary" onClick={() => copyPublicLink(event)}><Copy className="h-4 w-4" />Copiar link publico</Button>
                    <Button className="whitespace-nowrap" size="sm" variant="danger" disabled={deletingEventId === event.id} onClick={() => remove(event)}>
                      {deletingEventId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {deletingEventId === event.id ? "Excluindo" : "Excluir evento"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
