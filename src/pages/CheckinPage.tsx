import { collection, getDocs, query, where } from "firebase/firestore";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Check, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { confirmCheckin, validateCheckin } from "../services/email";
import { db } from "../services/firebase";
import type { Inscricao } from "../types";

export default function CheckinPage() {
  const { eventoId } = useParams();
  const { firebaseUser } = useAuth();
  const { confirmAction, notify } = useFeedback();
  const [result, setResult] = useState<Inscricao | null>(null);
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState("");
  const [guests, setGuests] = useState<Inscricao[]>([]);

  const handleToken = useCallback(async (tokenText: string) => {
    if (!firebaseUser || !eventoId) return;
    const token = await firebaseUser.getIdToken();
    const response = await validateCheckin(tokenText, eventoId, token);
    setStatus(response.status);
    setResult(response.inscricao || null);
  }, [eventoId, firebaseUser]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render((decodedText) => handleToken(decodedText), () => undefined);
    return () => {
      scanner.clear().catch(() => undefined);
    };
  }, [handleToken]);

  useEffect(() => {
    if (!eventoId) return;
    getDocs(query(collection(db, "inscricoes"), where("eventoId", "==", eventoId))).then((snap) => setGuests(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Inscricao)));
  }, [eventoId]);

  const manualResults = useMemo(() => {
    const term = manual.toLowerCase();
    if (!term) return [];
    return guests.filter((guest) => `${guest.email} ${guest.codigoConvite} ${Object.values(guest.respostas).join(" ")}`.toLowerCase().includes(term)).slice(0, 8);
  }, [manual, guests]);

  async function confirm() {
    if (!firebaseUser || !result) return;
    if (result.checkin.realizado) {
      const confirmed = await confirmAction({
        title: "Check-in já realizado",
        description: "Este convidado já teve entrada registrada. Deseja confirmar novamente mesmo assim?",
        confirmLabel: "Registrar novamente",
        tone: "danger",
      });
      if (!confirmed) return;
    }
    const token = await firebaseUser.getIdToken();
    await confirmCheckin(result.id, token);
    setStatus("confirmado");
    setResult({ ...result, checkin: { ...result.checkin, realizado: true } });
    notify({ type: "success", title: "Check-in confirmado", description: String(result.respostas.nome || result.email) });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-6">
        <div>
          <p className="page-kicker">Check-in</p>
          <h1 className="page-title">Leitor de QR Code</h1>
          <p className="page-description">A leitura valida empresa, evento, token e status antes de confirmar.</p>
        </div>
        <Card className="p-3">
          <div id="qr-reader" className="overflow-hidden rounded-lg" />
        </Card>
        <Card>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-violet-400" />
            <Input className="pl-9" placeholder="Buscar por nome, e-mail, código ou CPF" value={manual} onChange={(event) => setManual(event.target.value)} />
          </div>
          <div className="mt-4 space-y-2">
            {manualResults.map((guest) => (
              <button key={guest.id} className="w-full rounded-md border border-violet-200 bg-white p-3 text-left text-sm transition hover:bg-violet-50" onClick={() => { setResult(guest); setStatus(guest.checkin.realizado ? "ja_realizado" : "valido"); }}>
                <span className="font-medium">{String(guest.respostas.nome || guest.email)}</span>
                <span className="ml-2 text-violet-950/55">{guest.codigoConvite}</span>
              </button>
            ))}
          </div>
        </Card>
      </section>
      <aside>
        <Card className="sticky top-24">
          <CardTitle>Resultado</CardTitle>
          <div className="mt-4">
            {status && <Badge tone={status === "confirmado" || status === "valido" ? "green" : status === "ja_realizado" ? "amber" : "red"}>{status}</Badge>}
            {result ? (
              <div className="mt-4 space-y-3">
                <p className="text-xl font-medium">{String(result.respostas.nome || result.email)}</p>
                <p className="text-sm text-violet-950/60">{result.email}</p>
                <p className="rounded-md bg-violet-100 px-3 py-2 font-mono tracking-widest text-violet-950">{result.codigoConvite}</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-violet-950 p-3 text-xs text-violet-50">{JSON.stringify(result.respostas, null, 2)}</pre>
                <Button className="w-full" onClick={confirm}><Check className="h-4 w-4" />Confirmar check-in</Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-violet-950/60">Aponte a câmera para um QR Code ou busque manualmente.</p>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
