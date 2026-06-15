import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { useFeedback } from "../contexts/FeedbackContext";
import { db } from "../services/firebase";
import type { Evento, PaginaEvento } from "../types";

type ProgramacaoItem = NonNullable<PaginaEvento["programacao"]>[number];
type FaqItem = NonNullable<PaginaEvento["faq"]>[number];

const defaultPage = (event: Evento): Omit<PaginaEvento, "id" | "atualizadoEm"> => ({
  empresaId: event.empresaId,
  eventoId: event.id,
  publicada: true,
  eyebrow: "Inscrições abertas",
  titulo: event.nome,
  subtitulo: event.descricao,
  ctaPrincipal: "Garantir inscrição",
  ctaSecundario: "Ver detalhes",
  sobreTitulo: "Tudo pronto para receber sua inscrição",
  sobreTexto: event.descricao,
  cardTitulo: "Confirme sua presença",
  cardTexto: "Preencha o formulário público para receber seu convite com código e QR Code de acesso.",
  mostrarData: true,
  mostrarLocal: true,
  mostrarLogo: true,
  mostrarProgramacao: false,
  programacao: [],
  mostrarFaq: false,
  faq: [],
});

export default function EventPublicPageEditor() {
  const { eventoId } = useParams();
  const { notify } = useFeedback();
  const [event, setEvent] = useState<Evento | null>(null);
  const [page, setPage] = useState<Omit<PaginaEvento, "id" | "atualizadoEm"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!eventoId) return;
    let cancelled = false;
    Promise.all([getDoc(doc(db, "eventos", eventoId)), getDoc(doc(db, "paginasEvento", eventoId))])
      .then(([eventSnap, pageSnap]) => {
        if (cancelled || !eventSnap.exists()) return;
        const eventData = { id: eventSnap.id, ...eventSnap.data() } as Evento;
        setEvent(eventData);
        if (pageSnap.exists()) {
          const data = pageSnap.data() as PaginaEvento;
          setPage({ ...defaultPage(eventData), ...data, empresaId: eventData.empresaId, eventoId: eventData.id });
        } else {
          setPage(defaultPage(eventData));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventoId]);

  function update<K extends keyof Omit<PaginaEvento, "id" | "atualizadoEm">>(key: K, value: Omit<PaginaEvento, "id" | "atualizadoEm">[K]) {
    setPage((current) => current && { ...current, [key]: value });
  }

  function updateSchedule(id: string, patch: Partial<ProgramacaoItem>) {
    setPage((current) => current && {
      ...current,
      programacao: (current.programacao || []).map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  }

  function updateFaq(id: string, patch: Partial<FaqItem>) {
    setPage((current) => current && {
      ...current,
      faq: (current.faq || []).map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  }

  async function save() {
    if (!eventoId || !event || !page) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "paginasEvento", eventoId), {
        ...page,
        empresaId: event.empresaId,
        eventoId: event.id,
        programacao: (page.programacao || []).filter((item) => item.titulo.trim() || item.horario.trim()),
        faq: (page.faq || []).filter((item) => item.pergunta.trim() || item.resposta.trim()),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      notify({ type: "success", title: "Página salva", description: "A página pública do evento foi atualizada." });
    } catch (error) {
      notify({ type: "error", title: "Falha ao salvar", description: error instanceof Error ? error.message : "Tente novamente em instantes." });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !event || !page) return <p className="text-sm text-slate-500">Carregando editor da página...</p>;

  return (
    <div className="app-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Página pública</p>
          <h1 className="page-title">Editar página do evento</h1>
          <p className="page-description">Personalize textos, CTA, seções, programação e perguntas frequentes da landing pública.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild><Link to={`/evento/${event.id}`} target="_blank"><Eye className="h-4 w-4" />Ver página</Link></Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar página"}</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CardTitle>Hero</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Banner e logo vêm dos dados do evento. Aqui você controla a chamada principal.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={page.publicada} onChange={(event) => update("publicada", event.target.checked)} />
              Página publicada
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={page.mostrarLogo} onChange={(event) => update("mostrarLogo", event.target.checked)} />
              Mostrar logo
            </label>
            <div className="sm:col-span-2">
              <Label>Texto acima do título</Label>
              <Input value={page.eyebrow || ""} onChange={(event) => update("eyebrow", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input value={page.titulo || ""} onChange={(event) => update("titulo", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Subtítulo</Label>
              <Textarea value={page.subtitulo || ""} onChange={(event) => update("subtitulo", event.target.value)} />
            </div>
            <div>
              <Label>CTA principal</Label>
              <Input value={page.ctaPrincipal || ""} onChange={(event) => update("ctaPrincipal", event.target.value)} />
            </div>
            <div>
              <Label>CTA secundário</Label>
              <Input value={page.ctaSecundario || ""} onChange={(event) => update("ctaSecundario", event.target.value)} />
            </div>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <CardTitle>Detalhes</CardTitle>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={page.mostrarData} onChange={(event) => update("mostrarData", event.target.checked)} />
              Mostrar data
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={page.mostrarLocal} onChange={(event) => update("mostrarLocal", event.target.checked)} />
              Mostrar local
            </label>
            <div className="sm:col-span-2">
              <Label>Título da seção</Label>
              <Input value={page.sobreTitulo || ""} onChange={(event) => update("sobreTitulo", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Texto da seção</Label>
              <Textarea value={page.sobreTexto || ""} onChange={(event) => update("sobreTexto", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Título do card de inscrição</Label>
              <Input value={page.cardTitulo || ""} onChange={(event) => update("cardTitulo", event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Texto do card de inscrição</Label>
              <Textarea value={page.cardTexto || ""} onChange={(event) => update("cardTexto", event.target.value)} />
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Programação</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Adicione horários ou etapas do evento.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={page.mostrarProgramacao} onChange={(event) => update("mostrarProgramacao", event.target.checked)} />
                Mostrar
              </label>
            </div>
            {(page.programacao || []).map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[130px_1fr_auto]">
                <Input placeholder="Horário" value={item.horario} onChange={(event) => updateSchedule(item.id, { horario: event.target.value })} />
                <div className="grid gap-3">
                  <Input placeholder="Título" value={item.titulo} onChange={(event) => updateSchedule(item.id, { titulo: event.target.value })} />
                  <Textarea placeholder="Descrição" value={item.descricao || ""} onChange={(event) => updateSchedule(item.id, { descricao: event.target.value })} />
                </div>
                <Button type="button" variant="danger" size="icon" onClick={() => update("programacao", (page.programacao || []).filter((current) => current.id !== item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => update("programacao", [...(page.programacao || []), { id: crypto.randomUUID(), horario: "", titulo: "", descricao: "" }])}>
              <Plus className="h-4 w-4" />Adicionar item
            </Button>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Perguntas frequentes</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Responda dúvidas comuns antes da inscrição.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={page.mostrarFaq} onChange={(event) => update("mostrarFaq", event.target.checked)} />
                Mostrar
              </label>
            </div>
            {(page.faq || []).map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-3">
                  <Input placeholder="Pergunta" value={item.pergunta} onChange={(event) => updateFaq(item.id, { pergunta: event.target.value })} />
                  <Textarea placeholder="Resposta" value={item.resposta} onChange={(event) => updateFaq(item.id, { resposta: event.target.value })} />
                </div>
                <Button type="button" variant="danger" size="icon" onClick={() => update("faq", (page.faq || []).filter((current) => current.id !== item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => update("faq", [...(page.faq || []), { id: crypto.randomUUID(), pergunta: "", resposta: "" }])}>
              <Plus className="h-4 w-4" />Adicionar pergunta
            </Button>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-24 xl:self-start">
          <CardTitle>Resumo</CardTitle>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p><strong>Evento:</strong> {event.nome}</p>
            <p><strong>Status:</strong> {page.publicada ? "Página publicada" : "Página oculta"}</p>
            <p><strong>Programação:</strong> {(page.programacao || []).length} item(ns)</p>
            <p><strong>FAQ:</strong> {(page.faq || []).length} pergunta(s)</p>
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase text-slate-400">Link público</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-950/70">{`${location.origin}/evento/${event.id}`}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
