import { collection, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { Download, Mail, Search } from "lucide-react";
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
    const token = await firebaseUser?.getIdToken();
    if (!token) return;
    try {
      await resendInviteEmail(guest, token);
      notify({ type: "success", title: "Convite reenviado", description: `Enviamos o convite para ${guest.email}.` });
    } catch (error) {
      notify({ type: "error", title: "Falha ao reenviar", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    }
  }

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Convidados</p>
          <h1 className="page-title">Lista de convidados</h1>
          <p className="page-description">Busca, filtros, detalhes dinâmicos, reenvio de convite e exportação.</p>
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
          <table className="w-full min-w-[760px] text-left text-sm">
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
                  <td><Button size="sm" variant="secondary" onClick={() => resend(guest)}><Mail className="h-4 w-4" />Reenviar</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Button variant="secondary" onClick={() => load(false)}>Carregar mais</Button>
      <Card>
        <CardTitle>Detalhes dinâmicos</CardTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {filtered.slice(0, 4).map((guest) => (
            <pre key={guest.id} className="overflow-auto rounded-md bg-violet-950 p-3 text-xs text-violet-50">{JSON.stringify(guest.respostas, null, 2)}</pre>
          ))}
        </div>
      </Card>
    </div>
  );
}
