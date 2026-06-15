import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Activity, CalendarDays, CheckCircle2, Clock3, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { ErrorState } from "../components/ui/state";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime } from "../lib/utils";
import { db } from "../services/firebase";
import type { Evento, Inscricao } from "../types";

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [events, setEvents] = useState<Evento[]>([]);
  const [guests, setGuests] = useState<Inscricao[]>([]);
  const [stats, setStats] = useState({ eventos: 0, ativos: 0, inscritos: 0, checkins: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario) return;
    let cancelled = false;
    const eventFilters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    const guestFilters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    const eventsCountQuery = query(collection(db, "eventos"), ...eventFilters);
    const activeEventsCountQuery = query(collection(db, "eventos"), ...eventFilters, where("status", "==", "ativo"));
    const guestsCountQuery = query(collection(db, "inscricoes"), ...guestFilters);
    const checkinsCountQuery = query(collection(db, "inscricoes"), ...guestFilters, where("checkin.realizado", "==", true));

    Promise.all([
      getDocs(query(collection(db, "eventos"), ...eventFilters, orderBy("criadoEm", "desc"), limit(24))),
      getDocs(query(collection(db, "inscricoes"), ...guestFilters, orderBy("criadoEm", "desc"), limit(160))),
      getCountFromServer(eventsCountQuery),
      getCountFromServer(activeEventsCountQuery),
      getCountFromServer(guestsCountQuery),
      getCountFromServer(checkinsCountQuery),
    ]).then(([eventSnap, guestSnap, eventCount, activeCount, guestCount, checkinCount]) => {
      if (cancelled) return;
      setEvents(eventSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Evento));
      setGuests(guestSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao));
      setStats({
        eventos: eventCount.data().count,
        ativos: activeCount.data().count,
        inscritos: guestCount.data().count,
        checkins: checkinCount.data().count,
      });
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar o dashboard.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [usuario]);

  const recentGuests = guests.slice(0, 8);
  const attendanceRate = stats.inscritos ? Math.round((stats.checkins / stats.inscritos) * 100) : 0;

  const signupsByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return {
        key: date.toISOString().slice(0, 10),
        label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""),
        value: 0,
      };
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    guests.forEach((guest) => {
      const day = byKey.get(toDate(guest.criadoEm).toISOString().slice(0, 10));
      if (day) day.value += 1;
    });
    return days;
  }, [guests]);

  const checkinsByHour = useMemo(() => {
    const slots = [
      { label: "08h", from: 8, to: 11, value: 0 },
      { label: "12h", from: 12, to: 15, value: 0 },
      { label: "16h", from: 16, to: 19, value: 0 },
      { label: "20h", from: 20, to: 23, value: 0 },
    ];
    guests.forEach((guest) => {
      if (!guest.checkin.realizado || !guest.checkin.dataHora) return;
      const hour = toDate(guest.checkin.dataHora).getHours();
      const slot = slots.find((item) => hour >= item.from && hour <= item.to);
      if (slot) slot.value += 1;
    });
    return slots;
  }, [guests]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((event) => event.status === "ativo" && toDate(event.dataEvento).getTime() >= now)
      .sort((a, b) => toDate(a.dataEvento).getTime() - toDate(b.dataEvento).getTime())
      .slice(0, 4);
  }, [events]);

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

      {error && <ErrorState title="Dashboard indisponível" description={error} onRetry={() => location.reload()} />}

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
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-3 text-4xl font-medium tracking-normal">{loading ? "-" : value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Inscritos por dia</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Volume dos últimos 7 dias nos registros carregados.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-indigo-500" />
          </div>
          <BarChart data={signupsByDay} />
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Presença e check-ins</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Taxa geral e distribuição por horário.</p>
            </div>
            <Clock3 className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-500">Taxa de presença</p>
                <p className="mt-1 text-4xl font-medium tracking-normal">{loading ? "-" : `${attendanceRate}%`}</p>
              </div>
              <p className="text-sm text-slate-500">{stats.checkins} de {stats.inscritos}</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-indigo-50">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${attendanceRate}%` }} />
            </div>
          </div>
          <BarChart data={checkinsByHour} compact />
        </Card>
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
              events.slice(0, 8).map((event) => (
                <Link key={event.id} to={`/eventos/${event.id}/visao-geral`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">{event.nome}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(event.dataEvento)}</p>
                  </div>
                  <Badge tone={event.status === "ativo" ? "green" : event.status === "encerrado" ? "slate" : "amber"}>{event.status}</Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Últimos inscritos</CardTitle>
          <div className="mt-5 space-y-3">
            {recentGuests.map((guest) => (
              <div key={guest.id} className="rounded-xl bg-slate-50 p-4">
                <p className="truncate font-medium">{String(guest.respostas.nome || guest.email)}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{guest.email}</p>
              </div>
            ))}
            {recentGuests.length === 0 && <p className="text-sm text-slate-500">Sem inscrições recentes.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Próximos eventos</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link to="/eventos">Ver agenda</Link></Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingEvents.length === 0 ? (
            <EmptyState title="Nenhum evento próximo" description="Eventos ativos com data futura aparecerão aqui." />
          ) : (
            upcomingEvents.map((event) => (
              <Link key={event.id} to={`/eventos/${event.id}/visao-geral`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-200 hover:bg-slate-50">
                <p className="line-clamp-1 font-medium text-slate-950">{event.nome}</p>
                <p className="mt-2 text-sm text-slate-500">{formatDateTime(event.dataEvento)}</p>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{event.local}</p>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function toDate(value: Date | { seconds: number } | string | null | undefined) {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if ("seconds" in value) return new Date(value.seconds * 1000);
  return value;
}

function BarChart({ data, compact = false }: { data: Array<{ label: string; value: number }>; compact?: boolean }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className={compact ? "mt-5 space-y-3" : "mt-6 space-y-3"}>
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[44px_1fr_36px] items-center gap-3">
          <span className="text-xs font-medium uppercase text-slate-500">{item.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-indigo-50">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
          <span className="text-right text-sm font-medium text-slate-950">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
