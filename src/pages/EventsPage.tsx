import { collection, deleteDoc, doc, getDocs, orderBy, query, where } from "firebase/firestore";
import { Copy, Edit, FileText, MapPin, QrCode, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { formatDateTime } from "../lib/utils";
import { db } from "../services/firebase";
import type { Evento } from "../types";

export default function EventsPage() {
  const { usuario } = useAuth();
  const { confirmAction, notify } = useFeedback();
  const [events, setEvents] = useState<Evento[]>([]);

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
    const confirmed = await confirmAction({
      title: "Excluir evento?",
      description: `Você está prestes a excluir "${event.nome}". Esta ação não remove inscrições já exportadas.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;
    await deleteDoc(doc(db, "eventos", event.id));
    await load();
    notify({ type: "success", title: "Evento excluído", description: "A lista de eventos foi atualizada." });
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
        <Button asChild><Link to="/eventos/novo">Novo evento</Link></Button>
      </div>

      {events.length === 0 ? (
        <EmptyState title="Nenhum evento cadastrado" description="Comece criando um evento com formulário público e identidade visual própria." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event, index) => (
            <Card key={event.id} className="animate-fade-up overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(76,29,149,0.12)]" style={{ animationDelay: `${index * 45}ms` }}>
              <div className="relative m-3 h-56 overflow-hidden rounded-xl bg-violet-100">
                {event.bannerUrl ? (
                  <img src={event.bannerUrl} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
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
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button size="sm" variant="secondary" asChild><Link to={`/eventos/${event.id}`}><Edit className="h-4 w-4" />Editar</Link></Button>
                  <Button size="sm" variant="secondary" asChild><Link to={`/eventos/${event.id}/formulario`}><FileText className="h-4 w-4" />Formulário</Link></Button>
                  <Button size="sm" variant="secondary" asChild><Link to={`/eventos/${event.id}/inscritos`}><Users className="h-4 w-4" />Inscritos</Link></Button>
                  <Button size="sm" variant="secondary" asChild><Link to={`/eventos/${event.id}/checkin`}><QrCode className="h-4 w-4" />Check-in</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => copyPublicLink(event)}><Copy className="h-4 w-4" />Link</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(event)}><Trash2 className="h-4 w-4" />Excluir</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
