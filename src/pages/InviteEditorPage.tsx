import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { useFeedback } from "../contexts/FeedbackContext";
import { getFilePreview } from "../services/appwrite";
import { db } from "../services/firebase";
import type { Evento } from "../types";
import { getInviteRadius, normalizeInviteTheme } from "../utils/inviteTheme";
import { inviteSchema } from "../validations/schemas";

type FormData = z.infer<typeof inviteSchema>;
type InviteTemplate = { id: string; nome: string; mensagemConvite: string; mensagemSucesso: string; conviteTema: FormData["conviteTema"] };

const BRAND_COLOR = "#5b21b6";

const defaults: FormData = {
  mensagemConvite: "Estamos felizes em receber você. Apresente o QR Code na entrada do evento.",
  mensagemSucesso: "Sua inscrição foi confirmada. Enviamos o convite para seu e-mail.",
  conviteTema: normalizeInviteTheme(undefined, BRAND_COLOR),
};

const BUILTIN_INVITE_TEMPLATES: Omit<InviteTemplate, "id">[] = [
  {
    nome: "Webinar",
    mensagemConvite: "Sua inscrição foi confirmada. Use o QR Code abaixo para validar seu acesso.",
    mensagemSucesso: "Inscrição confirmada. Enviamos seu convite por e-mail.",
    conviteTema: normalizeInviteTheme({ layout: "compact", shape: "soft" }, BRAND_COLOR),
  },
  {
    nome: "Congresso",
    mensagemConvite: "Estamos felizes em receber você. Apresente este convite no credenciamento.",
    mensagemSucesso: "Sua participação foi confirmada. Guarde seu QR Code.",
    conviteTema: normalizeInviteTheme({ layout: "highlight", shape: "soft" }, BRAND_COLOR),
  },
  {
    nome: "Workshop",
    mensagemConvite: "Sua vaga foi reservada. Chegue com antecedência e apresente o QR Code na entrada.",
    mensagemSucesso: "Vaga reservada com sucesso. O convite foi enviado para seu e-mail.",
    conviteTema: normalizeInviteTheme({ layout: "classic", shape: "straight" }, BRAND_COLOR),
  },
  {
    nome: "Festa",
    mensagemConvite: "Sua presença foi confirmada. Apresente este convite na recepção.",
    mensagemSucesso: "Presença confirmada. Enviamos seu convite por e-mail.",
    conviteTema: normalizeInviteTheme({ layout: "highlight", shape: "pill" }, BRAND_COLOR),
  },
  {
    nome: "Reunião interna",
    mensagemConvite: "Sua participação foi registrada. Use o QR Code para controle de presença.",
    mensagemSucesso: "Participação confirmada. Enviamos o convite para seu e-mail.",
    conviteTema: normalizeInviteTheme({ layout: "compact", shape: "straight" }, BRAND_COLOR),
  },
];

const inviteColorFields = [
  { key: "backgroundColor", label: "Fundo externo" },
  { key: "cardBackgroundColor", label: "Fundo do convite" },
  { key: "accentColor", label: "Cor de destaque" },
  { key: "titleColor", label: "Titulo" },
  { key: "textColor", label: "Texto" },
  { key: "mutedTextColor", label: "Texto auxiliar" },
  { key: "borderColor", label: "Bordas" },
  { key: "detailsBackgroundColor", label: "Bloco de dados" },
  { key: "codeBackgroundColor", label: "Fundo do código" },
  { key: "codeTextColor", label: "Texto do código" },
  { key: "qrBackgroundColor", label: "Fundo do QR Code" },
  { key: "buttonBackgroundColor", label: "Botao/icone" },
  { key: "buttonTextColor", label: "Texto do botão" },
] as const;

export default function InviteEditorPage() {
  const { eventoId } = useParams();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [event, setEvent] = useState<Evento | null>(null);
  const [templates, setTemplates] = useState<InviteTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const form = useForm<FormData>({ resolver: zodResolver(inviteSchema), defaultValues: defaults });
  const { reset } = form;
  const previewThemeForm = useWatch({ control: form.control, name: "conviteTema" });
  const previewMessage = useWatch({ control: form.control, name: "mensagemConvite" });
  const previewSuccessMessage = useWatch({ control: form.control, name: "mensagemSucesso" });
  const previewTheme = normalizeInviteTheme(previewThemeForm, event?.corPrincipal || BRAND_COLOR);

  useEffect(() => {
    if (!eventoId) return;
    getDoc(doc(db, "eventos", eventoId)).then((snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Evento;
      setEvent(data);
      reset({
        mensagemConvite: data.mensagemConvite || defaults.mensagemConvite,
        mensagemSucesso: data.mensagemSucesso || defaults.mensagemSucesso,
        conviteTema: normalizeInviteTheme(data.conviteTema, data.corPrincipal || BRAND_COLOR),
      });
    });
  }, [eventoId, reset]);

  useEffect(() => {
    if (!event?.empresaId) return;
    getDocs(query(collection(db, "templates"), where("empresaId", "==", event.empresaId), where("tipo", "==", "convite"))).then((snap) => {
      setTemplates(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as InviteTemplate));
    });
  }, [event?.empresaId]);

  function applyTemplate(template: Omit<InviteTemplate, "id">) {
    form.setValue("mensagemConvite", template.mensagemConvite);
    form.setValue("mensagemSucesso", template.mensagemSucesso);
    form.setValue("conviteTema", normalizeInviteTheme(template.conviteTema, event?.corPrincipal || BRAND_COLOR));
    notify({ type: "info", title: "Template aplicado", description: `Modelo "${template.nome}" aplicado ao convite.` });
  }

  async function saveTemplate() {
    if (!event) return;
    const nome = templateName.trim();
    if (!nome) return;
    const data = form.getValues();
    setSavingTemplate(true);
    try {
      await addDoc(collection(db, "templates"), {
        empresaId: event.empresaId,
        tipo: "convite",
        nome,
        mensagemConvite: data.mensagemConvite,
        mensagemSucesso: data.mensagemSucesso,
        conviteTema: data.conviteTema,
        criadoEm: serverTimestamp(),
      });
      notify({ type: "success", title: "Template salvo", description: "Este modelo já pode ser reutilizado em outros eventos." });
      const snap = await getDocs(query(collection(db, "templates"), where("empresaId", "==", event.empresaId), where("tipo", "==", "convite")));
      setTemplates(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as InviteTemplate));
      setTemplateName("");
      setTemplateModalOpen(false);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function onSubmit(data: FormData) {
    if (!eventoId) return;
    await updateDoc(doc(db, "eventos", eventoId), {
      mensagemConvite: data.mensagemConvite,
      mensagemSucesso: data.mensagemSucesso,
      conviteTema: data.conviteTema,
      atualizadoEm: serverTimestamp(),
    });
    notify({ type: "success", title: "Convite salvo", description: "O convite do formulário e do e-mail foi atualizado." });
    navigate("/eventos");
  }

  if (!event) return <p className="text-sm text-violet-950/60">Carregando convite...</p>;
  const logoSrc = event.logoFileId ? getFilePreview(event.logoFileId) : event.logoUrl;

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-up">
      <div>
        <p className="page-kicker">Convite e e-mail</p>
        <h1 className="page-title">Personalizar convite</h1>
        <p className="page-description">Edite a tela final do formulário público e o convite recebido por e-mail para {event.nome}.</p>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Templates de convite</CardTitle>
            <p className="mt-1 text-sm text-violet-950/60">Aplique modelos prontos ou salve este convite como template da empresa.</p>
          </div>
          <Button variant="secondary" onClick={() => setTemplateModalOpen(true)}>Salvar como template</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[...BUILTIN_INVITE_TEMPLATES, ...templates].map((template) => (
            <Button key={String("id" in template ? template.id : template.nome)} size="sm" variant="secondary" onClick={() => applyTemplate(template)}>
              {template.nome}
            </Button>
          ))}
        </div>
      </Card>

      <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Mensagem do convite</Label>
            <Textarea {...form.register("mensagemConvite")} />
          </div>
          <div className="sm:col-span-2">
            <Label>Mensagem de sucesso</Label>
            <Textarea {...form.register("mensagemSucesso")} />
          </div>
          <div>
            <Label>Modelo</Label>
            <select className="h-11 w-full rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" {...form.register("conviteTema.layout")}>
              <option value="classic">Clássico</option>
              <option value="highlight">Destaque</option>
              <option value="compact">Compacto</option>
            </select>
          </div>
          <div>
            <Label>Formato</Label>
            <select className="h-11 w-full rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" {...form.register("conviteTema.shape")}>
              <option value="soft">Arredondado</option>
              <option value="straight">Reto</option>
              <option value="pill">Pill</option>
            </select>
          </div>
          {inviteColorFields.map((field) => (
            <label key={field.key} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-violet-100 bg-violet-50/50 p-3 text-sm text-violet-950">
              <span>{field.label}</span>
              <Input type="color" className="h-9 w-11 p-1" {...form.register(`conviteTema.${field.key}`)} />
            </label>
          ))}
          <Button className="sm:col-span-2" disabled={form.formState.isSubmitting}>
            <Save className="h-4 w-4" /> Salvar convite e e-mail
          </Button>
        </Card>

        <Card>
          <CardTitle>Prévia</CardTitle>
          <InvitePreview eventName={event.nome} logoSrc={logoSrc} message={previewMessage} successMessage={previewSuccessMessage} theme={previewTheme} />
        </Card>
      </form>

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="invite-template-title" aria-describedby="invite-template-description" onKeyDown={(event) => { if (event.key === "Escape") { setTemplateModalOpen(false); setTemplateName(""); } }}>
          <Card className="w-full max-w-md animate-scale-in">
            <CardTitle id="invite-template-title">Salvar template de convite</CardTitle>
            <p id="invite-template-description" className="mt-2 text-sm text-violet-950/60">Dê um nome claro para reutilizar este convite em outros eventos.</p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveTemplate();
              }}
            >
              <div>
                <Label>Nome do template</Label>
                <Input autoFocus value={templateName} placeholder="Ex.: Convite congresso premium" onChange={(event) => setTemplateName(event.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => { setTemplateModalOpen(false); setTemplateName(""); }}>Cancelar</Button>
                <Button disabled={!templateName.trim() || savingTemplate}>{savingTemplate ? "Salvando..." : "Salvar template"}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function InvitePreview({
  eventName,
  logoSrc,
  message,
  successMessage,
  theme,
}: {
  eventName: string;
  logoSrc?: string;
  message: string;
  successMessage: string;
  theme: ReturnType<typeof normalizeInviteTheme>;
}) {
  const radius = getInviteRadius(theme.shape);
  const compact = theme.layout === "compact";
  const highlight = theme.layout === "highlight";

  return (
    <div className="mt-3 overflow-hidden border p-3" style={{ backgroundColor: theme.backgroundColor, borderColor: theme.borderColor, borderRadius: radius }}>
      <div className="border" style={{ backgroundColor: theme.cardBackgroundColor, borderColor: theme.borderColor, borderRadius: Math.max(radius - 4, 4), overflow: "hidden" }}>
        {highlight && <div className="h-3" style={{ backgroundColor: theme.accentColor }} />}
        <div className={compact ? "p-4" : "p-5"}>
          {logoSrc ? (
            <img src={logoSrc} alt="" className="mb-3 h-12 w-12 object-cover" style={{ borderRadius: Math.max(radius - 8, 4) }} />
          ) : (
            <div className="mb-3 h-10 w-10" style={{ backgroundColor: theme.accentColor, borderRadius: Math.max(radius - 8, 4) }} />
          )}
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.accentColor }}>Convite confirmado</p>
          <h3 className={compact ? "mt-1 text-lg font-medium" : "mt-2 text-xl font-medium"} style={{ color: theme.titleColor }}>{eventName}</h3>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.textColor }}>{message}</p>
          <div className="mt-4 space-y-1 p-3 text-xs" style={{ backgroundColor: theme.detailsBackgroundColor, borderRadius: Math.max(radius - 8, 4), color: theme.textColor }}>
            <p><strong>Convidado:</strong> Maria Exemplo</p>
            <p><strong>Data:</strong> 02/06/2026 19:00</p>
            <p><strong>Local:</strong> Espaço do evento</p>
          </div>
          <div className="mt-4 text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center border text-[10px]" style={{ backgroundColor: theme.qrBackgroundColor, borderColor: theme.borderColor, borderRadius: Math.max(radius - 6, 4), color: theme.mutedTextColor }}>QR Code</div>
            <p className="mt-3 inline-block px-3 py-2 font-mono text-xs tracking-[0.28em]" style={{ backgroundColor: theme.codeBackgroundColor, color: theme.codeTextColor, borderRadius: Math.max(radius - 8, 4) }}>AB12CD</p>
          </div>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: theme.mutedTextColor }}>{successMessage}</p>
        </div>
      </div>
    </div>
  );
}
