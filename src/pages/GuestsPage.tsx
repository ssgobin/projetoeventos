import { collection, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { Download, Eye, Loader2, Mail, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { formatDateTime } from "../lib/utils";
import { resendInviteEmail } from "../services/email";
import { db } from "../services/firebase";
import type { Inscricao } from "../types";

export default function GuestsPage() {
  const { eventoId } = useParams();
  const { firebaseUser } = useAuth();
  const { notify } = useFeedback();
  const [guests, setGuests] = useState<Inscricao[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [selectedGuest, setSelectedGuest] = useState<Inscricao | null>(null);
  const [resendingGuestId, setResendingGuestId] = useState<string | null>(null);

  async function load(reset = false) {
    if (!eventoId) return;
    const clauses = [where("eventoId", "==", eventoId), orderBy("criadoEm", "desc"), limit(25)];
    const snap = await getDocs(reset || !cursor ? query(collection(db, "inscricoes"), ...clauses) : query(collection(db, "inscricoes"), ...clauses, startAfter(cursor)));
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao);
    setGuests(reset ? items : [...guests, ...items]);
    setCursor(snap.docs.at(-1) || null);
  }

  useEffect(() => {
    if (!eventoId) return;
    const clauses = [where("eventoId", "==", eventoId), orderBy("criadoEm", "desc"), limit(25)];
    getDocs(query(collection(db, "inscricoes"), ...clauses)).then((snap) => {
      setGuests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao));
      setCursor(snap.docs.at(-1) || null);
    });
  }, [eventoId]);

  const filtered = useMemo(() => {
    return guests.filter((guest) => {
      const text = `${guest.email} ${guest.codigoConvite} ${Object.values(guest.respostas).join(" ")}`.toLowerCase();
      const okSearch = text.includes(search.toLowerCase());
      const okStatus = status === "todos" || (status === "checkin" ? guest.checkin.realizado : !guest.checkin.realizado);
      return okSearch && okStatus;
    });
  }, [guests, search, status]);

  function exportXlsx() {
    const rows = filtered.map((guest) => ({
      email: guest.email,
      codigoConvite: guest.codigoConvite,
      checkin: guest.checkin.realizado ? "realizado" : "pendente",
      criadoEm: formatDateTime(guest.criadoEm),
      ...guest.respostas,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "inscritos");
    XLSX.writeFile(wb, "inscritos.xlsx");
    notify({ type: "success", title: "Exportação iniciada", description: `${rows.length} convidados foram preparados para Excel.` });
  }

  async function resend(guest: Inscricao) {
    if (resendingGuestId) return;
    const token = await firebaseUser?.getIdToken();
    if (!token) return;
    setResendingGuestId(guest.id);
    try {
      await resendInviteEmail(guest, token);
      notify({ type: "success", title: "Convite reenviado", description: `Enviamos o convite para ${guest.email}.` });
    } catch (error) {
      notify({ type: "error", title: "Falha ao reenviar", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    } finally {
      setResendingGuestId(null);
    }
  }

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Convidados</p>
          <h1 className="page-title">Lista de convidados</h1>
          <p className="page-description">Busca, filtros, informações completas, reenvio de convite e exportação.</p>
        </div>
        <Button onClick={exportXlsx}><Download className="h-4 w-4" />Exportar Excel</Button>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-violet-400" />
            <Input className="pl-9" placeholder="Buscar nome, e-mail, código ou CPF" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select className="h-11 rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="checkin">Com check-in</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-violet-50 text-xs uppercase text-violet-950/60">
              <tr><th className="p-4">Convidado</th><th>E-mail</th><th>Inscrição</th><th>Status</th><th>Código</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {filtered.map((guest) => (
                <tr key={guest.id} className="border-t border-violet-100">
                  <td className="p-4 font-medium">{String(guest.respostas.nome || "-")}</td>
                  <td>{guest.email}</td>
                  <td>{formatDateTime(guest.criadoEm)}</td>
                  <td><Badge tone={guest.checkin.realizado ? "green" : "amber"}>{guest.checkin.realizado ? "Check-in" : "Pendente"}</Badge></td>
                  <td className="font-mono">{guest.codigoConvite}</td>
                  <td>
                    <div className="flex flex-wrap gap-2 py-2 pr-4">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedGuest(guest)}><Eye className="h-4 w-4" />Ver</Button>
                      <Button size="sm" variant="secondary" disabled={resendingGuestId === guest.id} onClick={() => resend(guest)}>
                        {resendingGuestId === guest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {resendingGuestId === guest.id ? "Reenviando E-Mail" : "Reenviar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Button variant="secondary" onClick={() => load(false)}>Carregar mais</Button>

      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/45 p-4 backdrop-blur-sm">
          <Card className="max-h-[88vh] w-full max-w-2xl animate-scale-in overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Informações do convidado</CardTitle>
                <p className="mt-1 text-sm text-violet-950/60">{selectedGuest.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedGuest(null)} aria-label="Fechar detalhes">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Detail label="Nome" value={String(selectedGuest.respostas.nome || "-")} />
              <Detail label="E-mail" value={selectedGuest.email} />
              <Detail label="Código" value={selectedGuest.codigoConvite} />
              <Detail label="Inscrição" value={formatDateTime(selectedGuest.criadoEm)} />
              <Detail label="Check-in" value={selectedGuest.checkin.realizado ? "Realizado" : "Pendente"} />
              <Detail label="Data do check-in" value={selectedGuest.checkin.dataHora ? formatDateTime(selectedGuest.checkin.dataHora) : "-"} />
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
