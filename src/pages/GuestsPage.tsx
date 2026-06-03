import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryConstraint, type QueryDocumentSnapshot } from "firebase/firestore";
import { Download, ExternalLink, Eye, Loader2, Mail, Search, Send, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ErrorState } from "../components/ui/state";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { formatDateTime } from "../lib/utils";
import { bulkSendInvites, importGuests, resendInviteEmail } from "../services/email";
import { db } from "../services/firebase";
import type { Formulario, Inscricao } from "../types";

type EmailFilter = "todos" | "pendente" | "enviado" | "falhou";

function emailStatus(guest: Inscricao): EmailFilter {
  if (guest.emailStatus === "falhou") return "falhou";
  if (guest.emailStatus === "enviado" || guest.emailEnviado) return "enviado";
  return "pendente";
}

function inviteUrl(guest: Inscricao) {
  return `${location.origin}/convite/${encodeURIComponent(guest.id)}/${encodeURIComponent(guest.qrToken)}`;
}

export default function GuestsPage() {
  const { eventoId } = useParams();
  const { firebaseUser } = useAuth();
  const { confirmAction, notify } = useFeedback();
  const [guests, setGuests] = useState<Inscricao[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("todos");
  const [selectedGuest, setSelectedGuest] = useState<Inscricao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [resendingGuestId, setResendingGuestId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSendEmails, setImportSendEmails] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState("");

  const buildClauses = useCallback(() => {
    const clauses: QueryConstraint[] = [where("eventoId", "==", eventoId), orderBy("criadoEm", "desc"), limit(25)];
    if (status === "checkin") clauses.splice(1, 0, where("checkin.realizado", "==", true));
    if (status === "pendente") clauses.splice(1, 0, where("checkin.realizado", "==", false));
    return clauses;
  }, [eventoId, status]);

  const load = useCallback(async (reset = false) => {
    if (!eventoId) return;
    if (!reset && (!hasMore || loading)) return;

    setLoading(true);
    setLoadError("");
    try {
      const clauses = buildClauses();
      const snap = await getDocs(reset || !cursor ? query(collection(db, "inscricoes"), ...clauses) : query(collection(db, "inscricoes"), ...clauses, startAfter(cursor)));
      const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao);
      setGuests((current) => reset ? items : [...current, ...items]);
      setCursor(snap.docs.at(-1) || null);
      setHasMore(snap.docs.length === 25);
      if (reset) setSelectedIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
      setLoadError(message);
      notify({ type: "error", title: "Falha ao carregar inscritos", description: message });
    } finally {
      setLoading(false);
    }
  }, [buildClauses, cursor, eventoId, hasMore, loading, notify]);

  useEffect(() => {
    if (!eventoId) return;
    let cancelled = false;

    getDocs(query(collection(db, "inscricoes"), ...buildClauses()))
      .then((snap) => {
        if (cancelled) return;
        setLoadError("");
        setGuests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao));
        setCursor(snap.docs.at(-1) || null);
        setHasMore(snap.docs.length === 25);
        setSelectedIds(new Set());
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Tente novamente em instantes.";
        setLoadError(message);
        notify({ type: "error", title: "Falha ao carregar inscritos", description: message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildClauses, eventoId, notify, status]);

  useEffect(() => {
    if (!eventoId) return;
    getDoc(doc(db, "formularios", eventoId)).then((snap) => {
      if (snap.exists()) setFormulario({ id: snap.id, ...snap.data() } as Formulario);
    });
  }, [eventoId]);

  const filtered = useMemo(() => {
    return guests.filter((guest) => {
      const text = `${guest.email} ${guest.codigoConvite} ${Object.values(guest.respostas).join(" ")}`.toLowerCase();
      const okSearch = text.includes(search.toLowerCase());
      const okEmail = emailFilter === "todos" || emailStatus(guest) === emailFilter;
      return okSearch && okEmail;
    });
  }, [emailFilter, guests, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((guest) => selectedIds.has(guest.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filtered.forEach((guest) => next.delete(guest.id));
      else filtered.forEach((guest) => next.add(guest.id));
      return next;
    });
  }

  async function exportXlsx() {
    const confirmed = await confirmAction({
      title: "Exportar inscritos?",
      description: `A exportação usará os ${filtered.length} inscrito(s) carregados na lista atual. Carregue mais páginas antes de exportar se precisar de mais registros.`,
      confirmLabel: "Exportar Excel",
    });
    if (!confirmed) return;

    const rows = filtered.map((guest) => ({
      email: guest.email,
      codigoConvite: guest.codigoConvite,
      emailStatus: emailStatus(guest),
      emailErro: guest.emailErro || "",
      linkConvite: inviteUrl(guest),
      checkin: guest.checkin.realizado ? "realizado" : "pendente",
      criadoEm: formatDateTime(guest.criadoEm),
      ...guest.respostas,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "inscritos");
    XLSX.writeFile(wb, "inscritos.xlsx");
    notify({ type: "success", title: "Exportação iniciada", description: `${rows.length} convidados foram preparados para Excel.` });
  }

  function downloadCsvTemplate() {
    const fields = formulario?.campos?.length
      ? [...formulario.campos].sort((a, b) => a.ordem - b.ordem).map((field) => field.name || field.label)
      : ["nome", "email", "telefone"];
    const headers = Array.from(new Set(["nome", "email", ...fields]));
    const example = Object.fromEntries(headers.map((header) => [header, header === "email" ? "maria@empresa.com" : header === "nome" ? "Maria Exemplo" : ""]));
    const worksheet = XLSX.utils.json_to_sheet([example], { header: headers });
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `modelo-inscritos-${eventoId || "evento"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file?: File) {
    if (!file || !eventoId || importing) return;
    const token = await firebaseUser?.getIdToken();
    if (!token) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) throw new Error("A planilha não tem linhas para importar.");

      const result = await importGuests(eventoId, rows, importSendEmails, token);
      notify({
        type: result.failed.length ? "info" : "success",
        title: "Importação concluída",
        description: `${result.createdIds.length} criado(s), ${result.skipped.length} ignorado(s), ${result.sent.length} e-mail(s) enviado(s), ${result.failed.length} falha(s).`,
      });
      if (result.skipped.length) {
        console.table(result.skipped);
      }
      await load(true);
    } catch (error) {
      notify({ type: "error", title: "Falha na importação", description: error instanceof Error ? error.message : "Revise a planilha e tente novamente." });
    } finally {
      setImporting(false);
    }
  }

  async function resend(guest: Inscricao) {
    if (resendingGuestId) return;
    const confirmed = await confirmAction({
      title: "Reenviar convite?",
      description: `Um novo e-mail de convite será enviado para ${guest.email}.`,
      confirmLabel: "Reenviar",
    });
    if (!confirmed) return;

    const token = await firebaseUser?.getIdToken();
    if (!token) return;
    setResendingGuestId(guest.id);
    try {
      await resendInviteEmail(guest, token);
      notify({ type: "success", title: "Convite reenviado", description: `Enviamos o convite para ${guest.email}.` });
      await load(true);
    } catch (error) {
      notify({ type: "error", title: "Falha ao reenviar", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
      await load(true);
    } finally {
      setResendingGuestId(null);
    }
  }

  async function sendBulk(mode: "selected" | "pending" | "failed" | "all") {
    if (!eventoId || bulkSending) return;
    const ids = mode === "selected" ? [...selectedIds] : [];
    if (mode === "selected" && ids.length === 0) {
      notify({ type: "info", title: "Nenhum convidado selecionado", description: "Selecione ao menos um inscrito para enviar convites." });
      return;
    }
    const confirmed = await confirmAction({
      title: "Enviar convites em massa?",
      description: mode === "selected" ? `Serão enviados convites para ${ids.length} selecionado(s).` : "A função enviará até 300 convites deste filtro por vez.",
      confirmLabel: "Enviar convites",
    });
    if (!confirmed) return;

    const token = await firebaseUser?.getIdToken();
    if (!token) return;
    setBulkSending(true);
    try {
      const result = await bulkSendInvites(eventoId, mode, ids, token);
      notify({
        type: result.failed.length ? "info" : "success",
        title: "Envio em massa concluído",
        description: `${result.sent.length} enviado(s), ${result.failed.length} falha(s) de ${result.total} processado(s).`,
      });
      await load(true);
    } catch (error) {
      notify({ type: "error", title: "Falha no envio em massa", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    } finally {
      setBulkSending(false);
    }
  }

  function copyInvite(guest: Inscricao) {
    navigator.clipboard.writeText(inviteUrl(guest));
    notify({ type: "success", title: "Link copiado", description: "O convite individual está na área de transferência." });
  }

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Convidados</p>
          <h1 className="page-title">Lista de convidados</h1>
          <p className="page-description">Importação por planilha, status de e-mail, envio em massa, reenvio e exportação.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportXlsx}><Download className="h-4 w-4" />Exportar Excel</Button>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 md:grid-cols-[1fr_170px_170px]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-violet-400" />
              <Input className="pl-9" placeholder="Buscar nome, e-mail, código ou CPF nos registros carregados" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select
              className="h-11 rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              value={status}
              onChange={(event) => {
                setLoading(true);
                setStatus(event.target.value);
              }}
            >
              <option value="todos">Todos</option>
              <option value="pendente">Check-in pendente</option>
              <option value="checkin">Com check-in</option>
            </select>
            <select className="h-11 rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" value={emailFilter} onChange={(event) => setEmailFilter(event.target.value as EmailFilter)}>
              <option value="todos">Todos os e-mails</option>
              <option value="pendente">E-mail pendente</option>
              <option value="enviado">E-mail enviado</option>
              <option value="falhou">E-mail com falha</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-sm font-medium text-violet-950 shadow-sm transition hover:border-violet-300 hover:bg-violet-50">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Importando" : "Importar Excel/CSV"}
              <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => handleImport(event.target.files?.[0])} />
            </label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 text-sm text-violet-950">
              <input type="checkbox" checked={importSendEmails} onChange={(event) => setImportSendEmails(event.target.checked)} />
              Enviar ao importar
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={bulkSending} onClick={() => sendBulk("selected")}><Send className="h-4 w-4" />Enviar selecionados ({selectedIds.size})</Button>
          <Button size="sm" variant="secondary" disabled={bulkSending} onClick={() => sendBulk("pending")}><Mail className="h-4 w-4" />Enviar pendentes</Button>
          <Button size="sm" variant="secondary" disabled={bulkSending} onClick={() => sendBulk("failed")}><Mail className="h-4 w-4" />Reenviar falhas</Button>
          <Button size="sm" variant="secondary" onClick={downloadCsvTemplate}><Download className="h-4 w-4" />Baixar CSV modelo</Button>
          {bulkSending && <span className="inline-flex items-center gap-2 text-sm text-violet-950/60"><Loader2 className="h-4 w-4 animate-spin" />Processando envios...</span>}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loadError && <div className="p-4"><ErrorState title="Lista indisponível" description={loadError} onRetry={() => load(true)} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-violet-50 text-xs uppercase text-violet-950/60">
              <tr>
                <th className="p-4"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} /></th>
                <th>Convidado</th>
                <th>E-mail</th>
                <th>Inscrição</th>
                <th>Check-in</th>
                <th>Inscrição</th>
                <th>E-mail</th>
                <th>Código</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && guests.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-violet-950/60" colSpan={9}>Carregando inscritos...</td>
                </tr>
              )}
              {filtered.map((guest) => {
                const mailStatus = emailStatus(guest);
                return (
                  <tr key={guest.id} className="border-t border-violet-100">
                    <td className="p-4"><input type="checkbox" checked={selectedIds.has(guest.id)} onChange={() => toggleSelected(guest.id)} /></td>
                    <td className="font-medium">{String(guest.respostas.nome || "-")}</td>
                    <td>{guest.email}</td>
                    <td>{formatDateTime(guest.criadoEm)}</td>
                    <td><Badge tone={guest.checkin.realizado ? "green" : "amber"}>{guest.checkin.realizado ? "Check-in" : "Pendente"}</Badge></td>
                    <td><Badge tone={guest.statusInscricao === "espera" ? "amber" : "green"}>{guest.statusInscricao === "espera" ? "Lista de espera" : "Confirmado"}</Badge></td>
                    <td>
                      <div className="space-y-1">
                        <Badge tone={mailStatus === "enviado" ? "green" : mailStatus === "falhou" ? "red" : "amber"}>
                          {mailStatus === "enviado" ? "Enviado" : mailStatus === "falhou" ? "Falhou" : "Pendente"}
                        </Badge>
                        {guest.emailErro && <p className="max-w-[220px] truncate text-xs text-fuchsia-800" title={guest.emailErro}>{guest.emailErro}</p>}
                      </div>
                    </td>
                    <td className="font-mono">{guest.codigoConvite}</td>
                    <td>
                      <div className="flex flex-wrap gap-2 py-2 pr-4">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedGuest(guest)}><Eye className="h-4 w-4" />Ver</Button>
                        <Button size="sm" variant="secondary" onClick={() => copyInvite(guest)}><ExternalLink className="h-4 w-4" />Link</Button>
                        <Button size="sm" variant="secondary" disabled={resendingGuestId === guest.id} onClick={() => resend(guest)}>
                          {resendingGuestId === guest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          {resendingGuestId === guest.id ? "Reenviando" : "Reenviar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-violet-950/60" colSpan={9}>Nenhum inscrito encontrado com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={loading || !hasMore} onClick={() => load(false)}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {hasMore ? "Carregar mais" : "Todos os registros carregados"}
        </Button>
        <p className="text-sm text-violet-950/55">{filtered.length} de {guests.length} registro(s) carregado(s) exibido(s).</p>
      </div>

      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="guest-detail-title" onKeyDown={(event) => { if (event.key === "Escape") setSelectedGuest(null); }}>
          <Card className="max-h-[88vh] w-full max-w-2xl animate-scale-in overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle id="guest-detail-title">Informações do convidado</CardTitle>
                <p className="mt-1 text-sm text-violet-950/60">{selectedGuest.email}</p>
              </div>
              <Button autoFocus variant="ghost" size="icon" onClick={() => setSelectedGuest(null)} aria-label="Fechar detalhes">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Detail label="Nome" value={String(selectedGuest.respostas.nome || "-")} />
              <Detail label="E-mail" value={selectedGuest.email} />
              <Detail label="Código" value={selectedGuest.codigoConvite} />
              <Detail label="Status do e-mail" value={emailStatus(selectedGuest)} />
              <Detail label="Status da inscrição" value={selectedGuest.statusInscricao === "espera" ? "Lista de espera" : "Confirmado"} />
              <Detail label="Inscrição" value={formatDateTime(selectedGuest.criadoEm)} />
              <Detail label="Check-in" value={selectedGuest.checkin.realizado ? "Realizado" : "Pendente"} />
              <Detail label="Data do check-in" value={selectedGuest.checkin.dataHora ? formatDateTime(selectedGuest.checkin.dataHora) : "-"} />
              <Detail label="Link público" value={inviteUrl(selectedGuest)} />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-violet-950">Respostas do formulário</h3>
              <div className="mt-3 divide-y divide-violet-100 rounded-xl border border-violet-200">
                {Object.entries(selectedGuest.respostas).map(([key, value]) => (
                  <div key={key} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr]">
                    <p className="text-sm font-medium capitalize text-violet-950">{key}</p>
                    <p className="break-words text-sm text-violet-950/65">{Array.isArray(value) ? value.join(", ") : String(value || "-")}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedGuest.arquivos && selectedGuest.arquivos.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-violet-950">Arquivos enviados</h3>
                <div className="mt-3 space-y-2">
                  {selectedGuest.arquivos.map((file) => (
                    <a key={file.fileId} href={file.url} target="_blank" rel="noreferrer" className="block rounded-md border border-violet-200 px-3 py-2 text-sm text-violet-800 hover:bg-violet-50">
                      {file.nome}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <p className="text-xs font-medium uppercase text-violet-950/50">{label}</p>
      <p className="mt-1 break-words text-sm text-violet-950">{value}</p>
    </div>
  );
}
