import { collection, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryConstraint, type QueryDocumentSnapshot } from "firebase/firestore";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime } from "../lib/utils";
import { db } from "../services/firebase";
import type { LogAuditoria } from "../types";

const PAGE_SIZE = 25;
const HIDDEN_DETAIL_KEYS = new Set(["eventoId", "inscricaoId", "id", "uid", "token", "qrToken"]);

const actionLabels: Record<string, { label: string; tone: "green" | "amber" | "blue" | "slate" | "red" }> = {
  checkin_confirmado: { label: "Check-in confirmado", tone: "green" },
  inscricao_confirmada: { label: "Inscrição confirmada", tone: "green" },
  inscricao_lista_espera: { label: "Inscrição enviada para lista de espera", tone: "amber" },
  email_convite_enviado: { label: "Convite enviado", tone: "blue" },
  email_convite_reenviado: { label: "Convite reenviado", tone: "blue" },
  email_agendado_enviado: { label: "E-mail agendado enviado", tone: "blue" },
  email_agendado_falhou: { label: "Falha em e-mail agendado", tone: "red" },
  convites_massa_enviados: { label: "Convites em massa processados", tone: "blue" },
  convidados_importados: { label: "Convidados importados", tone: "slate" },
  convidados_exportados: { label: "Convidados exportados", tone: "slate" },
};

function actionMeta(action: string) {
  return actionLabels[action] || {
    label: action.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    tone: "slate" as const,
  };
}

function originLabel(usuarioId: string) {
  if (usuarioId === "public-form") return "Formulário público";
  if (usuarioId === "scheduled-job") return "Rotina agendada";
  if (usuarioId === "system") return "Sistema";
  return usuarioId ? "Usuário do sistema" : "Não informado";
}

function readableKey(key: string) {
  const labels: Record<string, string> = {
    categoria: "Categoria",
    total: "Total",
    enviados: "Enviados",
    falhas: "Falhas",
    sent: "Enviados",
    failed: "Falhas",
    mode: "Modo",
    modo: "Modo",
    email: "E-mail",
    codigoConvite: "Código",
    nome: "Nome",
    motivo: "Motivo",
    erro: "Erro",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function detailText(details?: Record<string, unknown>) {
  if (!details || Object.keys(details).length === 0) return "Sem detalhes adicionais.";

  const visible = Object.entries(details)
    .filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${readableKey(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`);

  if (visible.length > 0) return visible.join(" | ");
  if (details.inscricaoId) return "Registro de inscrição atualizado.";
  if (details.eventoId) return "Registro do evento atualizado.";
  return "Sem detalhes adicionais.";
}

export default function LogsPage() {
  const { usuario } = useAuth();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [page, setPage] = useState(0);
  const [pageStarts, setPageStarts] = useState<Array<QueryDocumentSnapshot<DocumentData> | null>>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const buildClauses = useCallback((): QueryConstraint[] => {
    if (!usuario) return [];
    const filters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    return [...filters, orderBy("dataHora", "desc"), limit(PAGE_SIZE)];
  }, [usuario]);

  const loadPage = useCallback(async (targetPage: number) => {
    if (!usuario) return;
    setLoading(true);
    setError("");
    try {
      const start = pageStarts[targetPage] || null;
      const clauses = buildClauses();
      const snap = await getDocs(start ? query(collection(db, "logs"), ...clauses, startAfter(start)) : query(collection(db, "logs"), ...clauses));
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LogAuditoria);
      setLogs(items);
      setPage(targetPage);
      setHasNextPage(snap.docs.length === PAGE_SIZE);
      const last = snap.docs.at(-1) || null;
      setPageStarts((current) => {
        const next = [...current];
        if (last) next[targetPage + 1] = last;
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os logs.");
      setLogs([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  }, [buildClauses, pageStarts, usuario]);

  useEffect(() => {
    setPage(0);
    setPageStarts([null]);
  }, [usuario?.empresaId, usuario?.role]);

  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.empresaId, usuario?.role]);

  const totals = useMemo(() => ({
    pageTotal: logs.length,
    checkins: logs.filter((log) => log.acao === "checkin_confirmado").length,
    emails: logs.filter((log) => log.acao.includes("email") || log.acao.includes("convite")).length,
  }), [logs]);

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Auditoria</p>
          <h1 className="page-title">Logs administrativos</h1>
          <p className="page-description">Acompanhe ações importantes com nomes legíveis, detalhes resumidos e paginação.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Registros nesta página" value={totals.pageTotal} />
        <Metric label="Check-ins nesta página" value={totals.checkins} />
        <Metric label="E-mails/convites nesta página" value={totals.emails} />
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 text-rose-700">
          <p className="text-sm font-medium">Falha ao carregar logs</p>
          <p className="mt-1 text-sm">{error}</p>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => loadPage(page)}>Tentar novamente</Button>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Página {page + 1}</p>
              <p className="mt-1 text-xs text-slate-500">Mostrando até {PAGE_SIZE} registros por página.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={loading || page === 0} onClick={() => loadPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button size="sm" variant="secondary" disabled={loading || !hasNextPage} onClick={() => loadPage(page + 1)}>
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-4">Data</th>
                <th>Ação</th>
                <th>Origem</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-6 text-center text-slate-500" colSpan={4}>
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando logs...</span>
                  </td>
                </tr>
              )}
              {!loading && logs.map((log) => {
                const meta = actionMeta(log.acao);
                return (
                  <tr key={log.id} className="border-t border-slate-200 align-top">
                    <td className="whitespace-nowrap p-4 text-slate-600">{formatDateTime(log.dataHora)}</td>
                    <td className="py-4 pr-4"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    <td className="max-w-[220px] truncate py-4 pr-4 text-slate-600" title={originLabel(log.usuarioId)}>{originLabel(log.usuarioId)}</td>
                    <td className="py-4 pr-4 text-slate-600">{detailText(log.detalhes)}</td>
                  </tr>
                );
              })}
              {!loading && logs.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-slate-500" colSpan={4}>Nenhum log encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </Card>
  );
}
