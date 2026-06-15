import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Check, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { LoadingState } from "../components/ui/state";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { confirmCheckin, validateCheckin } from "../services/email";
import { db } from "../services/firebase";
import type { Inscricao } from "../types";

function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export default function CheckinPage() {
  const { eventoId } = useParams();
  const { firebaseUser } = useAuth();
  const { confirmAction, notify } = useFeedback();
  const [result, setResult] = useState<Inscricao | null>(null);
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState("");
  const [manualResults, setManualResults] = useState<Inscricao[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleToken = useCallback(async (tokenText: string) => {
    if (!firebaseUser || !eventoId || validating) return;
    setValidating(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await validateCheckin(tokenText, eventoId, token);
      setStatus(response.status);
      setResult(response.inscricao || null);
    } catch (error) {
      notify({ type: "error", title: "Falha ao validar QR Code", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    } finally {
      setValidating(false);
    }
  }, [eventoId, firebaseUser, notify, validating]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render((decodedText) => handleToken(decodedText), () => undefined);
    return () => {
      scanner.clear().catch(() => undefined);
    };
  }, [handleToken]);

  useEffect(() => {
    if (!eventoId) return;
    const term = manual.trim();

    if (term.length < 3) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setManualLoading(true);
      try {
        const searches = [
          getDocs(query(collection(db, "inscricoes"), where("eventoId", "==", eventoId), where("codigoConvite", "==", term.toUpperCase()), limit(8))),
          getDocs(query(collection(db, "inscricoes"), where("eventoId", "==", eventoId), where("email", "==", term.toLowerCase()), limit(8))),
        ];
        const cpf = normalizeCpf(term);
        if (cpf.length === 11) {
          searches.push(getDocs(query(collection(db, "inscricoes"), where("eventoId", "==", eventoId), where("respostas.cpf", "==", cpf), limit(8))));
        }

        const snaps = await Promise.all(searches);
        if (cancelled) return;
        const byId = new Map<string, Inscricao>();
        snaps.flatMap((snap) => snap.docs).forEach((item) => {
          byId.set(item.id, { id: item.id, ...item.data() } as Inscricao);
        });
        setManualResults([...byId.values()]);
      } catch (error) {
        if (cancelled) return;
        setManualError(error instanceof Error ? error.message : "Não foi possível buscar inscritos.");
      } finally {
        if (!cancelled) setManualLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [eventoId, manual]);

  const manualHint = useMemo(() => {
    if (manual.trim().length === 0) return "Digite e-mail, código ou CPF completo para buscar.";
    if (manual.trim().length < 3) return "Digite ao menos 3 caracteres.";
    if (manualLoading) return "Buscando inscrito...";
    if (manualResults.length === 0) return "Nenhum resultado encontrado.";
    return `${manualResults.length} resultado(s) encontrado(s).`;
  }, [manual, manualLoading, manualResults.length]);

  async function confirm() {
    if (!firebaseUser || !result || confirming) return;
    if (result.checkin.realizado) {
      const confirmed = await confirmAction({
        title: "Check-in já realizado",
        description: "Este convidado já teve entrada registrada. Deseja confirmar novamente mesmo assim?",
        confirmLabel: "Registrar novamente",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setConfirming(true);
    try {
      const token = await firebaseUser.getIdToken();
      await confirmCheckin(result.id, token);
      setStatus("confirmado");
      notify({ type: "success", title: "Check-in confirmado", description: String(result.respostas.nome || result.email) });
      setResult(null);
      setStatus("");
    } catch (error) {
      notify({ type: "error", title: "Falha ao confirmar check-in", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    } finally {
      setConfirming(false);
    }
  }

  function cancelCheckin() {
    setResult(null);
    setStatus("");
  }

  return (
    <div className="space-y-6">
      <section className="space-y-6">
        <div>
          <p className="page-kicker">Check-in</p>
          <h1 className="page-title">Leitor de QR Code</h1>
          <p className="page-description">A leitura valida empresa, evento, token e status antes de confirmar.</p>
        </div>
        <Card className="p-3">
          <div id="qr-reader" className="overflow-hidden rounded-lg" aria-label="Leitor de QR Code" />
          {validating && <p className="px-3 pb-2 text-sm text-slate-500" role="status" aria-live="polite">Validando QR Code...</p>}
        </Card>
        <Card>
          <label className="mb-2 block text-sm font-medium text-slate-950" htmlFor="manual-search">Busca manual</label>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input
              id="manual-search"
              className="pl-9"
              placeholder="E-mail, código ou CPF completo"
              value={manual}
              onChange={(event) => {
                const value = event.target.value;
                setManual(value);
                setManualError("");
                if (value.trim().length < 3) {
                  setManualResults([]);
                  setManualLoading(false);
                }
              }}
              aria-describedby="manual-search-status"
            />
          </div>
          <p id="manual-search-status" className="mt-2 text-sm text-slate-500" role="status" aria-live="polite">{manualError || manualHint}</p>
          <div className="mt-4 space-y-2">
            {manualLoading && <LoadingState title="Buscando inscrito" description="Consultando e-mail, código e CPF sem carregar a lista inteira." />}
            {!manualLoading && manualResults.map((guest) => (
              <button key={guest.id} className="w-full rounded-md border border-slate-200 bg-white p-3 text-left text-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" onClick={() => { setResult(guest); setStatus(guest.checkin.realizado ? "ja_realizado" : "valido"); }}>
                <span className="font-medium">{String(guest.respostas.nome || guest.email)}</span>
                <span className="ml-2 text-slate-500">{guest.codigoConvite}</span>
              </button>
            ))}
          </div>
        </Card>
      </section>
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkin-dialog-title" onKeyDown={(event) => { if (event.key === "Escape") cancelCheckin(); }}>
          <Card className="max-h-[88vh] w-full max-w-2xl animate-scale-in overflow-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-kicker">Resultado da leitura</p>
                <CardTitle id="checkin-dialog-title">Confirmar check-in</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Confira os dados do convidado antes de registrar a entrada.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={cancelCheckin} aria-label="Cancelar check-in">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5">
              <Badge tone={status === "confirmado" || status === "valido" ? "green" : status === "ja_realizado" ? "amber" : "red"}>{status}</Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Detail label="Nome" value={String(result.respostas.nome || "-")} />
              <Detail label="E-mail" value={result.email} />
              <Detail label="Categoria" value={result.categoriaInscricao?.nome || "-"} />
              <Detail label="Código" value={result.codigoConvite} />
              <Detail label="Check-in" value={result.checkin.realizado ? "Já realizado" : "Pendente"} />
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-950">Respostas do formulário</h3>
              <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {Object.entries(result.respostas).map(([key, value]) => (
                  <div key={key} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr]">
                    <p className="text-sm font-medium capitalize text-slate-950">{key}</p>
                    <p className="break-words text-sm text-slate-600">{Array.isArray(value) ? value.join(", ") : String(value || "-")}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" onClick={cancelCheckin}>Cancelar</Button>
              <Button onClick={confirm} disabled={confirming} autoFocus>
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                {confirming ? "Confirmando..." : "Confirmar check-in"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-950">{value}</p>
    </div>
  );
}
