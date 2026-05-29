import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { useFeedback } from "../contexts/FeedbackContext";
import { slugify } from "../lib/utils";
import { uploadFile } from "../services/appwrite";
import { db } from "../services/firebase";
import type { CampoFormulario, FieldType, Formulario } from "../types";

const BRAND_THEME = { corPrincipal: "#5b21b6", modo: "light" as const };

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

export default function FormBuilderPage() {
  const { eventoId } = useParams();
  const { notify } = useFeedback();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventoId) return;
    getDoc(doc(db, "formularios", eventoId)).then((snap) => {
      setFormulario(snap.exists() ? ({ id: snap.id, ...snap.data(), tema: BRAND_THEME } as Formulario) : null);
    });
  }, [eventoId]);

  const hasRequiredEmail = useMemo(() => formulario?.campos.some((field) => field.type === "email" && field.required), [formulario]);

  function updateField(id: string, patch: Partial<CampoFormulario>) {
    setFormulario((current) => current && { ...current, campos: current.campos.map((field) => (field.id === id ? { ...field, ...patch } : field)) });
  }

  function addField(type: FieldType) {
    setFormulario((current) => {
      if (!current) return current;
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
    if (publish && !hasRequiredEmail) {
      setError("Para publicar, o formulário precisa ter um campo de e-mail obrigatório.");
      return;
    }

    try {
      const campos = formulario.campos.map(normalizeField);
      await updateDoc(doc(db, "formularios", formulario.id), {
        titulo: formulario.titulo,
        descricao: formulario.descricao,
        campos,
        emailObrigatorio: Boolean(hasRequiredEmail),
        publicado: publish ? true : formulario.publicado,
        tema: BRAND_THEME,
        headerImageUrl: formulario.headerImageUrl || null,
        headerImageFileId: formulario.headerImageFileId || null,
        atualizadoEm: serverTimestamp(),
      });
      setFormulario({ ...formulario, campos, tema: BRAND_THEME, publicado: publish ? true : formulario.publicado });
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="space-y-5">
        <div>
          <p className="page-kicker">Formulário</p>
          <h1 className="page-title">Construtor de formulário</h1>
          <p className="page-description">Adicione, edite, reordene e publique campos sem depender de suporte técnico.</p>
        </div>

        <Card className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Título</Label>
            <Input value={formulario.titulo} onChange={(event) => setFormulario({ ...formulario, titulo: event.target.value })} />
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <Label>Identidade visual</Label>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-9 w-9 rounded-md bg-violet-800" />
              <div>
                <p className="text-sm font-medium text-violet-950">Roxo e branco</p>
                <p className="text-xs text-violet-950/60">Padrão visual fixo do formulário.</p>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={formulario.descricao} onChange={(event) => setFormulario({ ...formulario, descricao: event.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-violet-300 bg-violet-50/70 p-4 text-sm text-violet-900 transition hover:bg-violet-50 sm:col-span-2">
            <ImagePlus className="h-4 w-4" /> Imagem de cabeçalho
            <input type="file" accept="image/*" className="hidden" onChange={(event) => headerUpload(event.target.files?.[0])} />
          </label>
        </Card>

        <Card>
          <CardTitle>Campos</CardTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            {fieldTypes.map((type) => (
              <Button key={type.value} variant="secondary" size="sm" onClick={() => addField(type.value)}>
                <Plus className="h-4 w-4" /> {type.label}
              </Button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {[...formulario.campos].sort((a, b) => a.ordem - b.ordem).map((field) => (
              <div key={field.id} className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 lg:grid-cols-[1fr_150px_120px_160px]">
                <div>
                  <Label>Rótulo</Label>
                  <Input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value, name: slugify(event.target.value) })} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <select className="h-11 w-full rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" value={field.type} onChange={(event) => updateField(field.id, { type: event.target.value as FieldType })}>
                    {fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
                  Obrigatório
                </label>
                <div className="flex items-end gap-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => move(field.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => move(field.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="danger" size="icon" onClick={() => setFormulario({ ...formulario, campos: formulario.campos.filter((item) => item.id !== field.id) })}><Trash2 className="h-4 w-4" /></Button>
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

        {error && <p className="rounded-md bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-800">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(false)}><Save className="h-4 w-4" />Salvar rascunho</Button>
          <Button variant="secondary" onClick={() => save(true)}><Eye className="h-4 w-4" />Publicar</Button>
        </div>
      </section>

      <aside className="space-y-4">
        <Card>
          <CardTitle>Prévia</CardTitle>
          <div className="mt-4 overflow-hidden rounded-xl border border-violet-200 bg-white">
            {formulario.headerImageUrl && <img src={formulario.headerImageUrl} className="h-32 w-full object-cover" alt="" />}
            <div className="p-5">
              <h2 className="text-xl font-medium text-violet-900">{formulario.titulo}</h2>
              <p className="mt-1 text-sm text-violet-950/60">{formulario.descricao}</p>
              <div className="mt-4 space-y-3">
                {formulario.campos.map((field) => (
                  <div key={field.id}>
                    <Label>{field.label}{field.required ? " *" : ""}</Label>
                    <Input placeholder={field.placeholder || field.label} disabled />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
