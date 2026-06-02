import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowDown, ArrowUp, Eye, FileText, ImagePlus, Palette, Plus, Save, Settings, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
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
  { value: "config", label: "Configuração", icon: Settings },
  { value: "appearance", label: "Aparência", icon: Palette },
  { value: "fields", label: "Campos", icon: FileText },
  { value: "preview", label: "Prévia", icon: Eye },
] as const;

type TabValue = (typeof tabs)[number]["value"];

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

function WithPreview({ children, formulario, theme }: { children: React.ReactNode; formulario: Formulario; theme: Formulario["tema"] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div>{children}</div>
      <div className="xl:sticky xl:top-24 xl:self-start">
        <FormPreview formulario={formulario} theme={theme} compact />
      </div>
    </div>
  );
}

export default function FormBuilderPage() {
  const { eventoId } = useParams();
  const { notify } = useFeedback();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("config");
  const [error, setError] = useState("");

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
    try {
      const uploaded = await uploadFile(file, { imagesOnly: true, maxMb: 6 });
      setFormulario({ ...formulario, headerImageUrl: uploaded.url, headerImageFileId: uploaded.fileId });
      notify({ type: "success", title: "Imagem enviada", description: "A prévia do formulário foi atualizada." });
    } catch (error) {
      notify({ type: "error", title: "Falha no upload", description: error instanceof Error ? error.message : "Tente enviar outro arquivo." });
    }
  }

  if (!formulario) return <p className="text-sm text-violet-950/60">Carregando formulário...</p>;

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
          className: "border-violet-200 bg-violet-50 text-violet-950",
          dotClassName: "bg-violet-500",
        };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <p className="page-kicker">Formulario público</p>
          <h1 className="page-title">Montar formulario de inscricao</h1>
          <p className="page-description">Edite textos, imagem, cores, campos e publicacao do formulario público.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)}><Save className="h-4 w-4" />Salvar formulario</Button>
          <Button variant="secondary" onClick={() => save(true)}><Eye className="h-4 w-4" />Publicar formulario</Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-800">{error}</p>}

      <Card className={`flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between ${status.className}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-1 h-3 w-3 rounded-full ${status.dotClassName}`} />
          <div>
            <p className="text-sm font-semibold">{status.title}</p>
            <p className="mt-1 text-sm opacity-75">{status.description}</p>
          </div>
        </div>
        {hasUnpublishedChanges && <p className="text-xs font-medium uppercase tracking-wide opacity-70">Ação pendente</p>}
      </Card>

      <Card className="p-2">
        <div className="grid gap-2 md:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition ${active ? "bg-violet-950 text-white" : "text-violet-950/68 hover:bg-violet-50 hover:text-violet-950"}`}
                onClick={() => setActiveTab(tab.value)}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeTab === "config" && (
        <WithPreview formulario={formulario} theme={theme}>
          <Card className="space-y-6">
            <div>
              <CardTitle>Configuração principal</CardTitle>
              <p className="mt-1 text-sm text-violet-950/60">Defina o conteúdo inicial e a imagem que aparecem no topo do formulário público.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label>Título</Label>
                <Input value={formulario.titulo} onChange={(event) => setFormulario({ ...formulario, titulo: event.target.value })} />
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-violet-300 bg-violet-50/70 p-4 text-sm text-violet-900 transition hover:bg-violet-50">
                <ImagePlus className="h-4 w-4" /> Imagem de cabeçalho
                <input type="file" accept="image/*" className="hidden" onChange={(event) => headerUpload(event.target.files?.[0])} />
              </label>
              <div className="lg:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={formulario.descricao} onChange={(event) => setFormulario({ ...formulario, descricao: event.target.value })} />
              </div>
            </div>
            {(formulario.headerImageFileId || formulario.headerImageUrl) && <img src={formulario.headerImageFileId ? getFilePreview(formulario.headerImageFileId) : formulario.headerImageUrl} className="h-44 w-full rounded-lg object-cover" alt="" />}
          </Card>
        </WithPreview>
      )}

      {activeTab === "appearance" && (
        <WithPreview formulario={formulario} theme={theme}>
          <Card className="space-y-6">
            <div>
              <CardTitle>Aparência</CardTitle>
              <p className="mt-1 text-sm text-violet-950/60">Personalize as cores do formulário público. As mudanças aparecem na prévia ao lado.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {themeControls.map((control) => (
                <label key={control.key} className="rounded-lg border border-violet-200 bg-white p-4 text-sm font-medium text-violet-950">
                  <div className="flex items-start justify-between gap-3">
                    <span>
                      {control.label}
                      <span className="mt-1 block text-xs font-normal text-violet-950/55">{control.description}</span>
                    </span>
                    <input
                      type="color"
                      className="h-10 w-12 cursor-pointer rounded border border-violet-200 bg-white"
                      value={theme[control.key]}
                      onChange={(event) => updateTheme(control.key, event.target.value)}
                    />
                  </div>
                  <span className="mt-3 block font-mono text-xs text-violet-950/55">{theme[control.key]}</span>
                </label>
              ))}
            </div>
          </Card>
        </WithPreview>
      )}

      {activeTab === "fields" && (
        <WithPreview formulario={formulario} theme={theme}>
          <Card className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Campos</CardTitle>
                <p className="mt-1 text-sm text-violet-950/60">Adicione, edite e reordene os campos. O e-mail é obrigatório e não pode ser removido.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {fieldTypes.map((type) => (
                  <Button key={type.value} variant="secondary" size="sm" disabled={type.value === "email" && formulario.campos.some(isEmailField)} onClick={() => addField(type.value)}>
                    <Plus className="h-4 w-4" /> {type.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {sortedFields.map((field) => (
                <div key={field.id} className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 lg:grid-cols-[1fr_150px_120px_160px]">
                  <div>
                    <Label>Rótulo</Label>
                    <Input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value, name: slugify(event.target.value) })} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <select className="h-11 w-full rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-violet-50 disabled:text-violet-950/60" value={field.type} disabled={isEmailField(field)} onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}>
                      {fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm">
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
                    <div className="lg:col-span-4">
                      <Label>Opções, uma por linha</Label>
                      <Textarea value={(field.options || []).join("\n")} onChange={(event) => updateField(field.id, { options: event.target.value.split("\n").filter(Boolean) })} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </WithPreview>
      )}

      {activeTab === "preview" && <FormPreview formulario={formulario} theme={theme} />}
    </div>
  );
}

function FormPreview({ formulario, theme, compact = false }: { formulario: Formulario; theme: Formulario["tema"]; compact?: boolean }) {
  return (
    <Card>
      <CardTitle>Prévia</CardTitle>
      <div className="mt-4 overflow-hidden rounded-xl border p-4" style={{ backgroundColor: theme.backgroundColor, borderColor: theme.inputBorderColor }}>
        <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: theme.cardBackgroundColor, borderColor: theme.inputBorderColor }}>
          {(formulario.headerImageFileId || formulario.headerImageUrl) && <img src={formulario.headerImageFileId ? getFilePreview(formulario.headerImageFileId) : formulario.headerImageUrl} className={`${compact ? "h-28" : "h-48"} w-full object-cover`} alt="" />}
          <div className={compact ? "p-4" : "p-6"}>
            <h2 className={`${compact ? "text-lg" : "text-2xl"} font-medium`} style={{ color: theme.titleColor }}>{formulario.titulo}</h2>
            <p className="mt-1 text-sm" style={{ color: theme.textColor }}>{formulario.descricao}</p>
            <div className="mt-4 space-y-3">
              {formulario.campos.slice(0, compact ? 4 : formulario.campos.length).map((field) => (
                <div key={field.id}>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: theme.labelColor }}>{field.label}{field.required ? " *" : ""}</label>
                  <Input placeholder={field.placeholder || field.label} disabled style={{ backgroundColor: theme.inputBackgroundColor, borderColor: theme.inputBorderColor, color: theme.inputTextColor }} />
                </div>
              ))}
            </div>
            {compact && formulario.campos.length > 4 && <p className="mt-3 text-xs" style={{ color: theme.textColor }}>+ {formulario.campos.length - 4} campo(s) na prévia completa</p>}
            <button className="mt-5 h-11 w-full rounded-md px-4 text-sm font-medium" style={{ backgroundColor: theme.buttonBackgroundColor, color: theme.buttonTextColor }} type="button">
              Confirmar inscrição
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
