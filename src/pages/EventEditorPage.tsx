import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { UploadProgress } from "../components/ui/upload-progress";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { getFilePreview, uploadFile, validateFile } from "../services/appwrite";
import { db } from "../services/firebase";
import type { Evento } from "../types";
import { DEFAULT_INVITE_THEME } from "../utils/inviteTheme";
import { eventSchema } from "../validations/schemas";

type FormData = z.infer<typeof eventSchema>;

const BRAND_COLOR = "#5b21b6";
const DEFAULT_EMAIL_AGENDA = {
  conviteAtivo: true,
  lembrete24hAtivo: true,
  lembreteDiaAtivo: true,
  posEventoAtivo: false,
  posEventoHorasDepois: 2,
  mensagemLembrete24h: "Seu evento acontece amanhã. Guarde seu QR Code e confira data, horário e local.",
  mensagemLembreteDia: "É hoje! Apresente seu QR Code na entrada para agilizar o check-in.",
  mensagemPosEvento: "Obrigado pela presença. Foi um prazer receber você neste evento.",
};
const DEFAULT_CATEGORIES = [
  { id: "participante", nome: "Participante", tipo: "gratuito" as const, capacidade: 0, listaEsperaAtiva: true, ativa: true, publica: true },
  { id: "vip", nome: "VIP", tipo: "gratuito" as const, capacidade: 0, listaEsperaAtiva: true, ativa: true, publica: true },
  { id: "imprensa", nome: "Imprensa", tipo: "gratuito" as const, capacidade: 0, listaEsperaAtiva: true, ativa: true, publica: true },
  { id: "palestrante", nome: "Palestrante", tipo: "gratuito" as const, capacidade: 0, listaEsperaAtiva: true, ativa: true, publica: true },
  { id: "staff", nome: "Staff", tipo: "gratuito" as const, capacidade: 0, listaEsperaAtiva: false, ativa: true, publica: false },
];

const defaults: FormData = {
  nome: "",
  descricao: "",
  local: "",
  dataEvento: "",
  status: "ativo",
  corPrincipal: BRAND_COLOR,
  tema: "light",
  permitirDuplicidadeEmail: false,
  capacidade: 0,
  listaEsperaAtiva: true,
  categoriasInscricao: DEFAULT_CATEGORIES,
  emailAgenda: DEFAULT_EMAIL_AGENDA,
};


export default function EventEditorPage() {
  const { eventoId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { notify } = useFeedback();
  const [event, setEvent] = useState<Evento | null>(null);
  const [uploading, setUploading] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [pendingImages, setPendingImages] = useState<{ banner?: File; logo?: File }>({});
  const [pendingPreviews, setPendingPreviews] = useState<{ banner?: string; logo?: string }>({});
  const [activeTab, setActiveTab] = useState<"dados" | "categorias">("dados");
  const pendingPreviewsRef = useRef(pendingPreviews);
  const form = useForm<FormData>({ resolver: zodResolver(eventSchema), defaultValues: defaults });
  const { reset } = form;
  const categories = form.watch("categoriasInscricao") || [];

  useEffect(() => {
    if (!eventoId) return;
    getDoc(doc(db, "eventos", eventoId)).then((snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Evento;
      setEvent(data);
      reset({
        nome: data.nome,
        descricao: data.descricao,
        local: data.local,
        dataEvento: new Date(data.dataEvento.seconds * 1000).toISOString().slice(0, 16),
        status: data.status,
        corPrincipal: data.corPrincipal || BRAND_COLOR,
        tema: "light",
        permitirDuplicidadeEmail: data.permitirDuplicidadeEmail,
        capacidade: data.capacidade || 0,
        listaEsperaAtiva: data.listaEsperaAtiva ?? true,
        categoriasInscricao: data.categoriasInscricao?.length ? data.categoriasInscricao : DEFAULT_CATEGORIES,
        emailAgenda: { ...DEFAULT_EMAIL_AGENDA, ...data.emailAgenda },
      });
    });
  }, [eventoId, reset]);

  useEffect(() => {
    pendingPreviewsRef.current = pendingPreviews;
  }, [pendingPreviews]);

  useEffect(() => {
    return () => {
      Object.values(pendingPreviewsRef.current).forEach((preview) => preview && URL.revokeObjectURL(preview));
    };
  }, []);

  async function onSubmit(data: FormData) {
    if (!usuario) return;
    const uploadedImages: Partial<Pick<Evento, "bannerUrl" | "bannerFileId" | "logoUrl" | "logoFileId">> = {};
    if (!eventoId) {
      try {
        for (const kind of ["banner", "logo"] as const) {
          const file = pendingImages[kind];
          if (!file) continue;
          setUploading(kind);
          const uploaded = await uploadFile(file, {
            imagesOnly: true,
            maxMb: 6,
            onProgress: (progress) => setUploadProgress((current) => ({ ...current, [kind]: progress })),
          });
          uploadedImages[`${kind}Url`] = uploaded.url;
          uploadedImages[`${kind}FileId`] = uploaded.fileId;
          setUploadProgress((current) => {
            const next = { ...current };
            delete next[kind];
            return next;
          });
        }
      } finally {
        setUploading("");
        setUploadProgress({});
      }
    }
    const payload = {
      ...data,
      ...uploadedImages,
      corPrincipal: data.corPrincipal,
      capacidade: Number(data.capacidade) || 0,
      listaEsperaAtiva: data.listaEsperaAtiva,
      categoriasInscricao: data.categoriasInscricao.map((category) => ({
        ...category,
        id: category.id || crypto.randomUUID(),
        nome: category.nome.trim(),
        capacidade: Number(category.capacidade) || 0,
      })),
      emailAgenda: {
        ...data.emailAgenda,
        posEventoHorasDepois: Number(data.emailAgenda.posEventoHorasDepois) || DEFAULT_EMAIL_AGENDA.posEventoHorasDepois,
      },
      tema: "light",
      empresaId: event?.empresaId || usuario.empresaId,
      dataEvento: Timestamp.fromDate(new Date(data.dataEvento)),
      atualizadoEm: serverTimestamp(),
    };
    if (eventoId) {
      await updateDoc(doc(db, "eventos", eventoId), payload);
      notify({ type: "success", title: "Evento salvo", description: "As alterações foram aplicadas." });
      navigate("/eventos");
      return;
    }
    const eventRef = await addDoc(collection(db, "eventos"), {
      ...payload,
      mensagemConvite: "Estamos felizes em receber você. Apresente o QR Code na entrada do evento.",
      mensagemSucesso: "Sua inscrição foi confirmada. Enviamos o convite para seu e-mail.",
      conviteTema: { ...DEFAULT_INVITE_THEME, accentColor: data.corPrincipal, buttonBackgroundColor: data.corPrincipal },
      criadoEm: serverTimestamp(),
    });
    await setDoc(doc(db, "formularios", eventRef.id), {
      empresaId: usuario.empresaId,
      eventoId: eventRef.id,
      titulo: data.nome,
      descricao: "Preencha seus dados para confirmar presença.",
      campos: [
        { id: crypto.randomUUID(), label: "Nome completo", name: "nome", type: "text", required: true, ordem: 1 },
        { id: crypto.randomUUID(), label: "E-mail", name: "email", type: "email", required: true, ordem: 2 },
      ],
      emailObrigatorio: true,
      publicado: false,
      tema: { corPrincipal: BRAND_COLOR, modo: "light" },
      atualizadoEm: serverTimestamp(),
    });
    notify({ type: "success", title: "Evento criado", description: "Agora personalize o formulário público." });
    navigate(`/eventos/${eventRef.id}/formulario`);
  }

  async function handleImage(file: File | undefined, kind: "banner" | "logo") {
    if (!file) return;
    if (!eventoId) {
      try {
        validateFile(file, { imagesOnly: true, maxMb: 6 });
        const previewUrl = URL.createObjectURL(file);
        setPendingImages((current) => ({ ...current, [kind]: file }));
        setPendingPreviews((current) => {
          if (current[kind]) URL.revokeObjectURL(current[kind]);
          return { ...current, [kind]: previewUrl };
        });
        notify({ type: "info", title: kind === "banner" ? "Banner selecionado" : "Logo selecionado", description: "A imagem será enviada quando você salvar o evento." });
      } catch {
        notify({ type: "error", title: "Falha ao selecionar imagem", description: "Verifique o arquivo e tente novamente." });
      }
      return;
    }
    setUploading(kind);
    setUploadProgress((current) => ({ ...current, [kind]: 0 }));
    try {
      const uploaded = await uploadFile(file, {
        imagesOnly: true,
        maxMb: 6,
        onProgress: (progress) => setUploadProgress((current) => ({ ...current, [kind]: progress })),
      });
      await updateDoc(doc(db, "eventos", eventoId), {
        [`${kind}Url`]: uploaded.url,
        [`${kind}FileId`]: uploaded.fileId,
        atualizadoEm: serverTimestamp(),
      });
      setEvent((current) => current && { ...current, [`${kind}Url`]: uploaded.url, [`${kind}FileId`]: uploaded.fileId });
      notify({ type: "success", title: kind === "banner" ? "Banner atualizado" : "Logo atualizado" });
    } catch {
      notify({ type: "error", title: "Falha no upload", description: "Verifique o arquivo e tente novamente." });
    } finally {
      setUploading("");
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[kind];
        return next;
      });
    }
  }

  function addCategory() {
    form.setValue("categoriasInscricao", [
      ...categories,
      { id: crypto.randomUUID(), nome: "Nova categoria", tipo: "gratuito", capacidade: 0, listaEsperaAtiva: true, ativa: true, publica: true },
    ], { shouldDirty: true });
  }

  function removeCategory(id: string) {
    form.setValue("categoriasInscricao", categories.filter((category) => category.id !== id), { shouldDirty: true });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-up">
      <div>
        <p className="page-kicker">Informações do evento</p>
        <h1 className="page-title">{eventoId ? "Editar dados do evento" : "Criar evento"}</h1>
        <p className="page-description">Nome, descrição, data, local, status, cor principal e imagens.</p>
      </div>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { id: "dados", label: "Dados do evento" },
            { id: "categorias", label: "Categorias e lotes" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "dados" | "categorias")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "dados" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CardTitle>Dados principais</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Informações básicas usadas no dashboard, convite e página pública.</p>
              </div>
              <div className="sm:col-span-2">
                <Label>Nome</Label>
                <Input {...form.register("nome")} />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea {...form.register("descricao")} />
              </div>
              <div>
                <Label>Data e horário</Label>
                <Input type="datetime-local" {...form.register("dataEvento")} />
              </div>
              <div>
                <Label>Local</Label>
                <Input {...form.register("local")} />
              </div>
              <div>
                <Label>Status</Label>
                <select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" {...form.register("status")}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Label>Identidade visual</Label>
                <div className="mt-2 flex items-center gap-3">
                  <Input type="color" className="h-10 w-12 p-1" {...form.register("corPrincipal")} />
                  <div>
                    <p className="text-sm font-medium text-slate-950">Cor principal</p>
                    <p className="text-xs text-slate-500">Usada como base do evento e dos convites.</p>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input type="checkbox" {...form.register("permitirDuplicidadeEmail")} />
                Permitir inscrições duplicadas por e-mail
              </label>
              <div>
                <Label>Capacidade</Label>
                <Input type="number" min={0} placeholder="0 = ilimitado" {...form.register("capacidade", { valueAsNumber: true })} />
              </div>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input type="checkbox" {...form.register("listaEsperaAtiva")} />
                Ativar lista de espera quando lotar
              </label>
              {!eventoId && Object.entries(uploadProgress).map(([kind, progress]) => (
                <div key={kind} className="sm:col-span-2">
                  <UploadProgress label={kind === "banner" ? "Enviando banner" : "Enviando logo"} progress={progress} />
                </div>
              ))}
            </Card>

            <Card>
              <CardTitle>Imagens</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Envie o banner e o logo que serão exibidos no evento e no convite.</p>
              <div className="mt-4 space-y-4">
                {(pendingPreviews.banner || event?.bannerFileId || event?.bannerUrl) && (
                  <img
                    src={pendingPreviews.banner || (event?.bannerFileId ? getFilePreview(event.bannerFileId) : event?.bannerUrl)}
                    alt=""
                    className="h-36 w-full rounded-md object-cover"
                  />
                )}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-800 transition hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" /> {uploading === "banner" ? "Enviando..." : "Enviar banner"}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0], "banner")} />
                </label>
                {uploading === "banner" && <UploadProgress label="Enviando banner" progress={uploadProgress.banner} />}
                {(pendingPreviews.logo || event?.logoFileId || event?.logoUrl) && (
                  <img
                    src={pendingPreviews.logo || (event?.logoFileId ? getFilePreview(event.logoFileId) : event?.logoUrl)}
                    alt=""
                    className="h-20 w-20 rounded-md object-cover"
                  />
                )}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-800 transition hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" /> {uploading === "logo" ? "Enviando..." : "Enviar logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0], "logo")} />
                </label>
                {uploading === "logo" && <UploadProgress label="Enviando logo" progress={uploadProgress.logo} />}
              </div>
            </Card>

            <Card className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              <div className="sm:col-span-2">
                <CardTitle>E-mails automáticos</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Configure convites e lembretes enviados pela rotina agendada.</p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="checkbox" {...form.register("emailAgenda.conviteAtivo")} />
                Enviar convites pendentes automaticamente
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="checkbox" {...form.register("emailAgenda.lembrete24hAtivo")} />
                Lembrete 24h antes
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="checkbox" {...form.register("emailAgenda.lembreteDiaAtivo")} />
                Lembrete no dia
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="checkbox" {...form.register("emailAgenda.posEventoAtivo")} />
                E-mail pós-evento
              </label>
              <div>
                <Label>Horas após o evento</Label>
                <Input type="number" min={1} max={168} {...form.register("emailAgenda.posEventoHorasDepois", { valueAsNumber: true })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Mensagem 24h antes</Label>
                <Textarea {...form.register("emailAgenda.mensagemLembrete24h")} />
              </div>
              <div className="sm:col-span-2">
                <Label>Mensagem no dia</Label>
                <Textarea {...form.register("emailAgenda.mensagemLembreteDia")} />
              </div>
              <div className="sm:col-span-2">
                <Label>Mensagem pós-evento</Label>
                <Textarea {...form.register("emailAgenda.mensagemPosEvento")} />
              </div>
            </Card>
          </div>
        )}

        {activeTab === "categorias" && (
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Categorias e lotes</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Controle VIP, imprensa, staff, participante, palestrante, gratuito/pago e lista de espera por categoria.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addCategory}><Plus className="h-4 w-4" />Adicionar</Button>
            </div>
            <div className="space-y-3">
              {categories.map((category, index) => (
                <div key={category.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_120px_140px_1fr_auto]">
                  <div>
                    <Label>Nome</Label>
                    <Input {...form.register(`categoriasInscricao.${index}.nome`)} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <select className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" {...form.register(`categoriasInscricao.${index}.tipo`)}>
                      <option value="gratuito">Gratuito</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>
                  <div>
                    <Label>Capacidade</Label>
                    <Input type="number" min={0} placeholder="0 = ilimitado" {...form.register(`categoriasInscricao.${index}.capacidade`, { valueAsNumber: true })} />
                  </div>
                  <div className="grid gap-2 pt-1 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" {...form.register(`categoriasInscricao.${index}.ativa`)} />
                      Ativa
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" {...form.register(`categoriasInscricao.${index}.publica`)} />
                      Aparece no formulário
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" {...form.register(`categoriasInscricao.${index}.listaEsperaAtiva`)} />
                      Lista de espera
                    </label>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="danger" size="icon" onClick={() => removeCategory(category.id)} disabled={categories.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="sticky bottom-4 z-10 flex justify-end rounded-lg border border-slate-200 bg-white/90 p-3 shadow-lg shadow-slate-200/70 backdrop-blur">
          <Button disabled={form.formState.isSubmitting}>
            <Save className="h-4 w-4" /> Salvar dados do evento
          </Button>
        </div>
      </form>
    </div>
  );
}
