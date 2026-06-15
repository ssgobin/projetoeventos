import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { ArrowDown, ArrowUp, Eye, FileText, ImagePlus, Palette, Plus, Save, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { UploadProgress } from "../components/ui/upload-progress";
import { useFeedback } from "../contexts/FeedbackContext";
import { slugify } from "../lib/utils";
import { getFilePreview, uploadFile } from "../services/appwrite";
import { db } from "../services/firebase";
import type { CampoFormulario, FieldType, Formulario } from "../types";

const DEFAULT_FORM_THEME = {
  corPrincipal: "#5b21b6",
  modo: "light" as const,
  backgroundColor: "#f5f3ff",
  cardBackgroundColor: "#ffffff",
  titleColor: "#1e1b4b",
  textColor: "#4c1d95",
  labelColor: "#2e1065",
  inputBackgroundColor: "#ffffff",
  inputTextColor: "#1e1b4b",
  inputBorderColor: "#ddd6fe",
  buttonBackgroundColor: "#2e1065",
  buttonTextColor: "#ffffff",
};

const tabs = [
  { value: "config", label: "Conteúdo", description: "Título, descrição e imagem", icon: Settings },
  { value: "fields", label: "Campos", description: "Perguntas e regras", icon: FileText },
  { value: "appearance", label: "Aparência", description: "Cores do formulário", icon: Palette },
  { value: "preview", label: "Prévia", description: "Visual final", icon: Eye },
] as const;

type TabValue = (typeof tabs)[number]["value"];
type FormTemplate = { id: string; nome: string; titulo: string; descricao: string; tema: Formulario["tema"]; campos: CampoFormulario[] };

const BUILTIN_FORM_TEMPLATES: Omit<FormTemplate, "id">[] = [
  {
    nome: "Webinar",
    titulo: "Inscrição para webinar",
    descricao: "Preencha seus dados para receber o acesso ao webinar.",
    tema: DEFAULT_FORM_THEME,
    campos: [
      { id: "webinar-nome", label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
      { id: "webinar-email", label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      { id: "webinar-empresa", label: "Empresa", name: "empresa", type: "text", required: false, ordem: 3 },
    ],
  },
  {
    nome: "Congresso",
    titulo: "Inscrição para congresso",
    descricao: "Informe seus dados para confirmar participação.",
    tema: DEFAULT_FORM_THEME,
    campos: [
      { id: "congresso-nome", label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
      { id: "congresso-email", label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      { id: "congresso-cpf", label: "CPF", name: "cpf", type: "cpf", required: true, ordem: 3 },
      { id: "congresso-instituicao", label: "Instituição", name: "instituicao", type: "text", required: false, ordem: 4 },
    ],
  },
  {
    nome: "Workshop",
    titulo: "Inscrição para workshop",
    descricao: "Escolha sua turma e confirme seus dados.",
    tema: DEFAULT_FORM_THEME,
    campos: [
      { id: "workshop-nome", label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
      { id: "workshop-email", label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      { id: "workshop-telefone", label: "Telefone", name: "telefone", type: "tel", required: false, ordem: 3 },
      { id: "workshop-turma", label: "Turma", name: "turma", type: "select", required: true, options: ["Manhã", "Tarde"], ordem: 4 },
    ],
  },
  {
    nome: "Festa",
    titulo: "Confirmação de presença",
    descricao: "Confirme sua presença e informe seus dados.",
    tema: DEFAULT_FORM_THEME,
    campos: [
      { id: "festa-nome", label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
      { id: "festa-email", label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      { id: "festa-acompanhante", label: "Levará acompanhante?", name: "acompanhante", type: "radio", required: true, options: ["Sim", "Não"], ordem: 3 },
      { id: "festa-nome-acompanhante", label: "Nome do acompanhante", name: "nome-do-acompanhante", type: "text", required: true, ordem: 4, conditional: { fieldId: "festa-acompanhante", fieldName: "acompanhante", value: "Sim" } },
    ],
  },
  {
    nome: "Reunião interna",
    titulo: "Confirmação para reunião interna",
    descricao: "Confirme seus dados para organização da reunião.",
    tema: DEFAULT_FORM_THEME,
    campos: [
      { id: "reuniao-nome", label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
      { id: "reuniao-email", label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      { id: "reuniao-area", label: "Área/departamento", name: "area", type: "text", required: false, ordem: 3 },
    ],
  },
];

const themeControls = [
  { key: "backgroundColor", label: "Fundo da página", description: "Área externa do formulário público." },
  { key: "cardBackgroundColor", label: "Fundo do card", description: "Container principal do formulário." },
  { key: "titleColor", label: "Título", description: "Título e mensagem principal." },
  { key: "textColor", label: "Texto", description: "Descrição e opções." },
  { key: "labelColor", label: "Labels", description: "Nomes dos campos." },
  { key: "inputBackgroundColor", label: "Fundo dos inputs", description: "Campos de texto e seleção." },
  { key: "inputTextColor", label: "Texto dos inputs", description: "Conteúdo digitado." },
  { key: "inputBorderColor", label: "Borda dos inputs", description: "Bordas e divisórias." },
  { key: "buttonBackgroundColor", label: "Botão", description: "Botão de envio e código." },
  { key: "buttonTextColor", label: "Texto do botão", description: "Texto sobre o botão." },
] as const;

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "email", label: "E-mail" },
  { value: "tel", label: "Telefone" },
  { value: "cpf", label: "CPF" },
  { value: "date", label: "Data" },
  { value: "number", label: "Número" },
  { value: "select", label: "Select" },
  { value: "radio", label: "Rádio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "Upload" },
  { value: "terms", label: "Aceite de termos" },
];

const fieldTypeGroups: { title: string; description: string; types: FieldType[] }[] = [
  { title: "Dados", description: "Informações digitadas pelo participante.", types: ["text", "textarea", "email", "tel", "cpf", "date", "number"] },
  { title: "Escolhas", description: "Perguntas com alternativas.", types: ["select", "radio", "checkbox"] },
  { title: "Avançados", description: "Arquivos e consentimentos.", types: ["file", "terms"] },
];

function hasOptions(type: FieldType) {
  return ["select", "radio", "checkbox"].includes(type);
}

function normalizeField(field: CampoFormulario): CampoFormulario {
  const normalized: CampoFormulario = {
    id: field.id,
    label: field.label,
    name: field.name,
    type: field.type,
    required: field.required,
    ordem: field.ordem,
  };

  if (field.placeholder) normalized.placeholder = field.placeholder;
  if (hasOptions(field.type)) normalized.options = (field.options || []).filter(Boolean);
  if (field.conditional?.fieldId && field.conditional.value) {
    normalized.conditional = {
      fieldId: field.conditional.fieldId,
      fieldName: field.conditional.fieldName,
      value: field.conditional.value,
    };
  }

  return normalized;
}

function isEmailField(field: CampoFormulario) {
  return field.type === "email" || field.name === "email";
}

function makeEmailField(ordem: number): CampoFormulario {
  return {
    id: crypto.randomUUID(),
    label: "E-mail",
    name: "email",
    type: "email",
    required: true,
    ordem,
  };
}

function getConditionOptions(controller?: CampoFormulario) {
  if (!controller) return [];
  if (controller.type === "terms") return ["Sim", "Não"];
  if (controller.type === "checkbox") return controller.options || [];
  if (hasOptions(controller.type)) return controller.options || [];
  return [];
}

function getConditionalController(field: CampoFormulario, fields: CampoFormulario[]) {
  return fields.find((item) => item.id === field.conditional?.fieldId);
}

function enforceRequiredEmail(campos: CampoFormulario[]) {
  const sorted = [...campos].sort((a, b) => a.ordem - b.ordem);
  const emailIndex = sorted.findIndex(isEmailField);
  const next = emailIndex >= 0 ? sorted : [...sorted, makeEmailField(sorted.length + 1)];
  const enforcedEmailIndex = emailIndex >= 0 ? emailIndex : next.length - 1;

  return next.map((field, index) => ({
    ...field,
    ...(index === enforcedEmailIndex ? { name: "email", type: "email" as const, required: true } : {}),
    ordem: index + 1,
  }));
}

function normalizeTheme(theme?: Partial<Formulario["tema"]>): Formulario["tema"] {
  return { ...DEFAULT_FORM_THEME, ...theme, modo: "light" };
}

function getFormSnapshot(formulario: Formulario) {
  return JSON.stringify({
    titulo: formulario.titulo,
    descricao: formulario.descricao,
    headerImageUrl: formulario.headerImageUrl || null,
    headerImageFileId: formulario.headerImageFileId || null,
    publicado: formulario.publicado,
    tema: normalizeTheme(formulario.tema),
    campos: enforceRequiredEmail(formulario.campos).map(normalizeField),
  });
}

export default function FormBuilderPage() {
  const { eventoId } = useParams();
  const { confirmAction, notify } = useFeedback();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("config");
  const [error, setError] = useState("");
  const [headerUploadProgress, setHeaderUploadProgress] = useState<number | null>(null);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!eventoId) return;
    getDoc(doc(db, "formularios", eventoId)).then((snap) => {
      if (!snap.exists()) {
        setFormulario(null);
        return;
      }

      const data = { id: snap.id, ...snap.data() } as Formulario;
      const normalized = { ...data, campos: enforceRequiredEmail(data.campos || []), tema: normalizeTheme(data.tema) };
      setFormulario(normalized);
      setLastSavedSnapshot(getFormSnapshot(normalized));
    });
  }, [eventoId]);

  useEffect(() => {
    if (!formulario?.empresaId) return;
    getDocs(query(collection(db, "templates"), where("empresaId", "==", formulario.empresaId), where("tipo", "==", "formulario"))).then((snap) => {
      setTemplates(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as FormTemplate));
    });
  }, [formulario?.empresaId]);

  function applyTemplate(template: Omit<FormTemplate, "id">) {
    if (!formulario) return;
    setFormulario({
      ...formulario,
      titulo: template.titulo,
      descricao: template.descricao,
      tema: normalizeTheme(template.tema),
      campos: enforceRequiredEmail(template.campos.map((field, index) => ({ ...field, id: crypto.randomUUID(), ordem: index + 1 }))),
    });
    notify({ type: "info", title: "Template aplicado", description: `Modelo "${template.nome}" aplicado ao formulário.` });
  }

  async function saveTemplate() {
    if (!formulario) return;
    const nome = templateName.trim();
    if (!nome) return;
    setSavingTemplate(true);
    try {
      await addDoc(collection(db, "templates"), {
        empresaId: formulario.empresaId,
        tipo: "formulario",
        nome,
        titulo: formulario.titulo,
        descricao: formulario.descricao,
        tema: normalizeTheme(formulario.tema),
        campos: enforceRequiredEmail(formulario.campos).map(normalizeField),
        criadoEm: serverTimestamp(),
      });
      notify({ type: "success", title: "Template salvo", description: "Este modelo já pode ser reutilizado em outros eventos." });
      const snap = await getDocs(query(collection(db, "templates"), where("empresaId", "==", formulario.empresaId), where("tipo", "==", "formulario")));
      setTemplates(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as FormTemplate));
      setTemplateName("");
      setTemplateModalOpen(false);
    } finally {
      setSavingTemplate(false);
    }
  }

  function updateField(id: string, patch: Partial<CampoFormulario>) {
    setFormulario((current) => {
      if (!current) return current;
      const campos = current.campos.map((field) => {
        if (field.id !== id) return field;
        const next = { ...field, ...patch };
        return isEmailField(field) ? { ...next, name: "email", type: "email" as const, required: true } : next;
      });
      return { ...current, campos: enforceRequiredEmail(campos) };
    });
  }

  function addField(type: FieldType) {
    setFormulario((current) => {
      if (!current) return current;
      if (type === "email" && current.campos.some(isEmailField)) return current;
      const label = fieldTypes.find((item) => item.value === type)?.label || "Campo";
      const next: CampoFormulario = {
        id: crypto.randomUUID(),
        label,
        name: slugify(label),
        type,
        required: type === "email",
        ordem: current.campos.length + 1,
      };
      if (hasOptions(type)) next.options = ["Opção 1", "Opção 2"];
      return { ...current, campos: [...current.campos, next] };
    });
  }

  function updateTheme(key: keyof Formulario["tema"], value: string) {
    setFormulario((current) => current && { ...current, tema: normalizeTheme({ ...current.tema, [key]: value }) });
  }

  function move(id: string, direction: -1 | 1) {
    setFormulario((current) => {
      if (!current) return current;
      const campos = [...current.campos].sort((a, b) => a.ordem - b.ordem);
      const index = campos.findIndex((field) => field.id === id);
      const target = index + direction;
      if (target < 0 || target >= campos.length) return current;
      [campos[index], campos[target]] = [campos[target], campos[index]];
      return { ...current, campos: campos.map((field, i) => ({ ...field, ordem: i + 1 })) };
    });
  }

  async function save(publish = false) {
    if (!formulario) return;
    setError("");

    if (publish) {
      const confirmed = await confirmAction({
        title: formulario.publicado ? "Publicar alterações?" : "Publicar formulário?",
        description: formulario.publicado
          ? "As alterações salvas ficarão disponíveis imediatamente no formulário público."
          : "O formulário ficará disponível para receber inscrições assim que o evento estiver ativo.",
        confirmLabel: formulario.publicado ? "Publicar alterações" : "Publicar formulário",
      });
      if (!confirmed) return;
    }

    try {
      const campos = enforceRequiredEmail(formulario.campos).map(normalizeField);
      const tema = normalizeTheme(formulario.tema);
      await updateDoc(doc(db, "formularios", formulario.id), {
        titulo: formulario.titulo,
        descricao: formulario.descricao,
        campos,
        emailObrigatorio: true,
        publicado: publish ? true : formulario.publicado,
        tema,
        headerImageUrl: formulario.headerImageUrl || null,
        headerImageFileId: formulario.headerImageFileId || null,
        atualizadoEm: serverTimestamp(),
      });
      const savedFormulario = { ...formulario, campos, tema, emailObrigatorio: true, publicado: publish ? true : formulario.publicado };
      setFormulario(savedFormulario);
      setLastSavedSnapshot(getFormSnapshot(savedFormulario));
      notify({
        type: "success",
        title: publish ? "Formulário publicado" : "Rascunho salvo",
        description: publish ? "O formulário público já pode receber inscrições." : "As alterações foram salvas com segurança.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o formulário.");
      notify({ type: "error", title: "Falha ao salvar", description: "Revise os campos e tente novamente." });
    }
  }

  async function headerUpload(file?: File) {
    if (!file || !formulario) return;
    setHeaderUploadProgress(0);
    try {
      const uploaded = await uploadFile(file, { imagesOnly: true, maxMb: 6, onProgress: setHeaderUploadProgress });
      setFormulario({ ...formulario, headerImageUrl: uploaded.url, headerImageFileId: uploaded.fileId });
      notify({ type: "success", title: "Imagem enviada", description: "A prévia do formulário foi atualizada." });
    } catch (error) {
      notify({ type: "error", title: "Falha no upload", description: error instanceof Error ? error.message : "Tente enviar outro arquivo." });
    } finally {
      setHeaderUploadProgress(null);
    }
  }

  if (!formulario) return <p className="text-sm text-slate-500">Carregando formulário...</p>;

  const theme = normalizeTheme(formulario.tema);
  const sortedFields = [...formulario.campos].sort((a, b) => a.ordem - b.ordem);
  const hasUnpublishedChanges = lastSavedSnapshot !== null && getFormSnapshot(formulario) !== lastSavedSnapshot;
  const status = hasUnpublishedChanges
    ? {
        title: "Alterações não publicadas",
        description: "Existem mudanças nesta edição que ainda não foram salvas ou publicadas.",
        className: "border-amber-200 bg-amber-50 text-amber-950",
        dotClassName: "bg-amber-500",
      }
    : formulario.publicado
      ? {
          title: "Publicado",
          description: "O formulário público está disponível para receber inscrições.",
          className: "border-emerald-200 bg-emerald-50 text-emerald-950",
          dotClassName: "bg-emerald-500",
        }
      : {
          title: "Não publicado",
          description: "O formulário ainda não está disponível para o público.",
          className: "border-slate-200 bg-slate-50 text-slate-950",
          dotClassName: "bg-slate-500",
        };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <p className="page-kicker">Formulário público</p>
          <h1 className="page-title">Montar formulário de inscrição</h1>
          <p className="page-description">Organize conteúdo, campos, aparência e publicação em um único fluxo de edição.</p>
        </div>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="space-y-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <Card className={`border p-5 ${status.className}`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-3 w-3 rounded-full ${status.dotClassName}`} />
                <div>
                  <p className="text-sm font-semibold">{status.title}</p>
                  <p className="mt-1 text-sm opacity-75">{status.description}</p>
                  {hasUnpublishedChanges && <p className="mt-3 text-xs font-medium uppercase tracking-wide opacity-70">Ação pendente</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save(false)}><Save className="h-4 w-4" />Salvar rascunho</Button>
                <Button variant="secondary" onClick={() => save(true)}><Eye className="h-4 w-4" />Publicar</Button>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Templates</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Aplique um modelo pronto ou salve este formulário.</p>
              </div>
              <Button variant="ghost" onClick={() => setTemplateModalOpen(true)}>Salvar template</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...BUILTIN_FORM_TEMPLATES, ...templates].map((template) => (
                <Button key={String("id" in template ? template.id : template.nome)} size="sm" variant="secondary" onClick={() => applyTemplate(template)}>
                  {template.nome}
                </Button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-2">
          <div className="grid gap-2 md:grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left transition ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className={`mt-0.5 block text-xs ${active ? "text-white/70" : "text-slate-500"}`}>{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {activeTab === "config" && (
          <Card className="space-y-7 p-6">
            <div>
              <CardTitle>Configuração principal</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Defina o conteúdo inicial e a imagem que aparecem no topo do formulário público.</p>
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <Label>Título</Label>
                <Input value={formulario.titulo} onChange={(event) => setFormulario({ ...formulario, titulo: event.target.value })} />
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-800 transition hover:bg-slate-50">
                <ImagePlus className="h-4 w-4" /> Imagem de cabeçalho
                <input type="file" accept="image/*" className="hidden" onChange={(event) => headerUpload(event.target.files?.[0])} />
              </label>
              {headerUploadProgress !== null && <UploadProgress label="Enviando imagem de cabeçalho" progress={headerUploadProgress} />}
              <div className="lg:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={formulario.descricao} onChange={(event) => setFormulario({ ...formulario, descricao: event.target.value })} />
              </div>
            </div>
            {(formulario.headerImageFileId || formulario.headerImageUrl) && <img src={formulario.headerImageFileId ? getFilePreview(formulario.headerImageFileId) : formulario.headerImageUrl} className="h-44 w-full rounded-lg object-cover" alt="" />}
          </Card>
        )}

        {activeTab === "appearance" && (
          <Card className="space-y-7 p-6">
            <div>
              <CardTitle>Aparência</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Personalize as cores do formulário público. Use a aba de prévia para conferir o resultado completo.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {themeControls.map((control) => (
                <label key={control.key} className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-950">
                  <div className="flex items-start justify-between gap-3">
                    <span>
                      {control.label}
                      <span className="mt-1 block text-xs font-normal text-slate-500">{control.description}</span>
                    </span>
                    <input
                      type="color"
                      className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white"
                      value={theme[control.key]}
                      onChange={(event) => updateTheme(control.key, event.target.value)}
                    />
                  </div>
                  <span className="mt-3 block font-mono text-xs text-slate-500">{theme[control.key]}</span>
                </label>
              ))}
            </div>
          </Card>
        )}

        {activeTab === "fields" && (
          <div className="space-y-6">
            <Card className="space-y-5 p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>Campos</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Adicione perguntas e organize regras condicionais sem perder largura de edição.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xl font-semibold text-slate-950">{sortedFields.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Campos</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xl font-semibold text-slate-950">{sortedFields.filter((field) => field.required).length}</p>
                    <p className="mt-1 text-xs text-slate-500">Obrigatórios</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xl font-semibold text-slate-950">{sortedFields.filter((field) => field.conditional).length}</p>
                    <p className="mt-1 text-xs text-slate-500">Condicionais</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {fieldTypeGroups.map((group) => (
                  <div key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.types.map((typeValue) => {
                        const type = fieldTypes.find((item) => item.value === typeValue)!;
                        return (
                          <Button key={type.value} variant="secondary" size="sm" disabled={type.value === "email" && formulario.campos.some(isEmailField)} onClick={() => addField(type.value)}>
                            <Plus className="h-4 w-4" /> {type.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-5 p-6">
              <div>
                <CardTitle>Perguntas do formulário</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Cada pergunta usa a largura total da tela, com opções e condições em linhas próprias.</p>
              </div>
              <div className="space-y-5">
                {sortedFields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    fields={sortedFields}
                    formulario={formulario}
                    updateField={updateField}
                    setFormulario={setFormulario}
                    move={move}
                  />
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="mx-auto max-w-3xl">
            <FormPreview formulario={formulario} theme={theme} />
          </div>
        )}
      </div>

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="form-template-title" aria-describedby="form-template-description" onKeyDown={(event) => { if (event.key === "Escape") { setTemplateModalOpen(false); setTemplateName(""); } }}>
          <Card className="w-full max-w-md animate-scale-in">
            <CardTitle id="form-template-title">Salvar template de formulário</CardTitle>
            <p id="form-template-description" className="mt-2 text-sm text-slate-500">Dê um nome claro para reutilizar este modelo em outros eventos.</p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveTemplate();
              }}
            >
              <div>
                <Label>Nome do template</Label>
                <Input autoFocus value={templateName} placeholder="Ex.: Webinar institucional" onChange={(event) => setTemplateName(event.target.value)} />
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

function FieldEditor({
  field,
  fields,
  formulario,
  updateField,
  setFormulario,
  move,
}: {
  field: CampoFormulario;
  fields: CampoFormulario[];
  formulario: Formulario;
  updateField: (id: string, patch: Partial<CampoFormulario>) => void;
  setFormulario: React.Dispatch<React.SetStateAction<Formulario | null>>;
  move: (id: string, direction: -1 | 1) => void;
}) {
  const conditionalFields = fields.filter((item) => item.id !== field.id && (hasOptions(item.type) || item.type === "terms"));
  const controller = getConditionalController(field, fields);
  const conditionOptions = getConditionOptions(controller);

  return (
    <div className="grid gap-5 rounded-lg border border-slate-200 bg-slate-50 p-5 xl:grid-cols-[minmax(320px,1fr)_180px_140px_170px]">
      <div className="space-y-1.5">
        <Label>Rótulo</Label>
        <Input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value, name: slugify(event.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" value={field.type} disabled={isEmailField(field)} onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}>
          {fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
        <input type="checkbox" checked={field.required} disabled={isEmailField(field)} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
        Obrigatório
      </label>
      <div className="flex items-end gap-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => move(field.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => move(field.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
        {!isEmailField(field) && (
          <Button type="button" variant="danger" size="icon" onClick={() => setFormulario({ ...formulario, campos: enforceRequiredEmail(formulario.campos.filter((item) => item.id !== field.id)) })}><Trash2 className="h-4 w-4" /></Button>
        )}
      </div>
      {hasOptions(field.type) && (
        <div className="space-y-1.5 xl:col-span-4">
          <Label>Opções, uma por linha</Label>
          <Textarea value={(field.options || []).join("\n")} onChange={(event) => updateField(field.id, { options: event.target.value.split("\n").filter(Boolean) })} />
        </div>
      )}
      {!isEmailField(field) && (
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 xl:col-span-4 xl:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label>Mostrar este campo quando</Label>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              value={field.conditional?.fieldId || ""}
              onChange={(event) => {
                const selected = fields.find((item) => item.id === event.target.value);
                updateField(field.id, {
                  conditional: selected ? { fieldId: selected.id, fieldName: selected.name, value: getConditionOptions(selected)[0] || "" } : undefined,
                });
              }}
            >
              <option value="">Sempre visível</option>
              {conditionalFields.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Resposta for</Label>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              value={field.conditional?.value || ""}
              disabled={!controller}
              onChange={(event) => updateField(field.id, { conditional: field.conditional && { ...field.conditional, fieldName: controller?.name || field.conditional.fieldName, value: event.target.value } })}
            >
              {!controller && <option value="">Selecione um campo</option>}
              {conditionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="ghost" disabled={!field.conditional} onClick={() => updateField(field.id, { conditional: undefined })}>
              Remover condição
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormPreview({ formulario, theme, compact = false }: { formulario: Formulario; theme: Formulario["tema"]; compact?: boolean }) {
  return (
    <Card className="p-5">
      <CardTitle>Prévia</CardTitle>
      <div className="mt-5 overflow-hidden rounded-lg border p-5" style={{ backgroundColor: theme.backgroundColor, borderColor: theme.inputBorderColor }}>
        <div className="overflow-hidden rounded-lg border" style={{ backgroundColor: theme.cardBackgroundColor, borderColor: theme.inputBorderColor }}>
          {(formulario.headerImageFileId || formulario.headerImageUrl) && <img src={formulario.headerImageFileId ? getFilePreview(formulario.headerImageFileId) : formulario.headerImageUrl} className={`${compact ? "h-28" : "h-48"} w-full object-cover`} alt="" />}
          <div className={compact ? "p-5" : "p-7"}>
            <h2 className={`${compact ? "text-lg" : "text-2xl"} font-medium`} style={{ color: theme.titleColor }}>{formulario.titulo}</h2>
            <p className="mt-2 text-sm" style={{ color: theme.textColor }}>{formulario.descricao}</p>
            <div className="mt-5 space-y-4">
              {formulario.campos.slice(0, compact ? 4 : formulario.campos.length).map((field) => (
                <div key={field.id}>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: theme.labelColor }}>{field.label}{field.required ? " *" : ""}</label>
                  <Input placeholder={field.placeholder || field.label} disabled style={{ backgroundColor: theme.inputBackgroundColor, borderColor: theme.inputBorderColor, color: theme.inputTextColor }} />
                  {field.conditional && <p className="mt-1 text-xs" style={{ color: theme.textColor }}>Aparece se uma resposta específica for selecionada.</p>}
                </div>
              ))}
            </div>
            {compact && formulario.campos.length > 4 && <p className="mt-3 text-xs" style={{ color: theme.textColor }}>+ {formulario.campos.length - 4} campo(s) na prévia completa</p>}
            <button className="mt-6 h-11 w-full rounded-md px-4 text-sm font-medium" style={{ backgroundColor: theme.buttonBackgroundColor, color: theme.buttonTextColor }} type="button">
              Confirmar inscrição
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
