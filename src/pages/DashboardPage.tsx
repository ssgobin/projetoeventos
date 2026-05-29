import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Activity, CalendarDays, CheckCircle2, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime } from "../lib/utils";
import { db } from "../services/firebase";
import type { Evento, Inscricao } from "../types";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [events, setEvents] = useState<Evento[]>([]);
  const [guests, setGuests] = useState<Inscricao[]>([]);

  useEffect(() => {
    if (!usuario) return;
    const eventFilters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    const guestFilters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    Promise.all([
      getDocs(query(collection(db, "eventos"), ...eventFilters, orderBy("criadoEm", "desc"), limit(8))),
      getDocs(query(collection(db, "inscricoes"), ...guestFilters, orderBy("criadoEm", "desc"), limit(8))),
    ]).then(([eventSnap, guestSnap]) => {
      setEvents(eventSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Evento));
      setGuests(guestSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao));
    });
  }, [usuario]);

  const stats = useMemo(
    () => ({
      eventos: events.length,
      ativos: events.filter((event) => event.status === "ativo").length,
      inscritos: guests.length,
      checkins: guests.filter((guest) => guest.checkin?.realizado).length,
    }),
    [events, guests]
  );

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Resumo</p>
          <h1 className="page-title">Painel da organizadora</h1>
          <p className="page-description">Visão executiva dos eventos, inscritos e check-ins em um painel claro para decisões rápidas.</p>
        </div>
        <Button asChild><Link to="/eventos/novo">Criar evento</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {([
          ["Eventos", stats.eventos, CalendarDays],
          ["Ativos", stats.ativos, Activity],
          ["Inscritos", stats.inscritos, Users],
          ["Check-ins", stats.checkins, CheckCircle2],
        ] as [string, number, LucideIcon][]).map(([label, value, Icon], index) => (
          <Card key={label} className="animate-fade-up p-6" style={{ animationDelay: `${index * 55}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-violet-950/60">{label}</p>
                <p className="mt-3 text-4xl font-medium tracking-normal">{value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Eventos recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/eventos">Ver todos</Link></Button>
          </div>
          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <EmptyState title="Nenhum evento ainda" description="Crie o primeiro evento para publicar um formulário e receber inscritos." />
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-4 rounded-xl border border-violet-100 bg-violet-50/70 p-4 transition hover:bg-violet-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.nome}</p>
                    <p className="mt-1 text-sm text-violet-950/55">{formatDateTime(event.dataEvento)}</p>
                  </div>
                  <Badge tone={event.status === "ativo" ? "green" : event.status === "encerrado" ? "slate" : "amber"}>{event.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Últimos inscritos</CardTitle>
          <div className="mt-5 space-y-3">
            {guests.map((guest) => (
              <div key={guest.id} className="rounded-xl bg-violet-50 p-4">
                <p className="truncate font-medium">{String(guest.respostas.nome || guest.email)}</p>
                <p className="mt-1 truncate text-sm text-violet-950/55">{guest.email}</p>
              </div>
            ))}
            {guests.length === 0 && <p className="text-sm text-violet-950/60">Sem inscrições recentes.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
