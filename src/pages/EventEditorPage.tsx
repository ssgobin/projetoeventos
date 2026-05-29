import { zodResolver } from "@hookform/resolvers/zod";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { ImagePlus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardTitle } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { useAuth } from "../contexts/AuthContext";
import { useFeedback } from "../contexts/FeedbackContext";
import { uploadFile } from "../services/appwrite";
import { db } from "../services/firebase";
import type { Evento } from "../types";
import { eventSchema } from "../validations/schemas";

type FormData = z.infer<typeof eventSchema>;

const BRAND_COLOR = "#5b21b6";

const defaults: FormData = {
  nome: "",
  descricao: "",
  local: "",
  dataEvento: "",
  status: "ativo",
  corPrincipal: BRAND_COLOR,
  tema: "light",
  permitirDuplicidadeEmail: false,
  mensagemConvite: "Estamos felizes em receber você. Apresente o QR Code na entrada do evento.",
  mensagemSucesso: "Sua inscrição foi confirmada. Enviamos o convite para seu e-mail.",
};

export default function EventEditorPage() {
  const { eventoId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { notify } = useFeedback();
  const [event, setEvent] = useState<Evento | null>(null);
  const [uploading, setUploading] = useState("");
  const form = useForm<FormData>({ resolver: zodResolver(eventSchema), defaultValues: defaults });
  const { reset } = form;

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
        corPrincipal: BRAND_COLOR,
        tema: "light",
        permitirDuplicidadeEmail: data.permitirDuplicidadeEmail,
        mensagemConvite: data.mensagemConvite,
        mensagemSucesso: data.mensagemSucesso,
      });
    });
  }, [eventoId, reset]);

  async function onSubmit(data: FormData) {
    if (!usuario) return;
    const payload = {
      ...data,
      corPrincipal: BRAND_COLOR,
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
    const eventRef = await addDoc(collection(db, "eventos"), { ...payload, criadoEm: serverTimestamp() });
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
    if (!file || !eventoId) return;
    setUploading(kind);
    try {
      const uploaded = await uploadFile(file, { imagesOnly: true, maxMb: 6 });
      await updateDoc(doc(db, "eventos", eventoId), {
        [`${kind}Url`]: uploaded.url,
        [`${kind}FileId`]: uploaded.fileId,
        atualizadoEm: serverTimestamp(),
      });
      notify({ type: "success", title: kind === "banner" ? "Banner atualizado" : "Logo atualizado" });
    } catch {
      notify({ type: "error", title: "Falha no upload", description: "Verifique o arquivo e tente novamente." });
    } finally {
      setUploading("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-up">
      <div>
        <p className="page-kicker">Evento</p>
        <h1 className="page-title">{eventoId ? "Editar evento" : "Criar evento"}</h1>
        <p className="page-description">Dados principais, identidade visual e mensagens do convite.</p>
      </div>
      <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="grid gap-4 sm:grid-cols-2">
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
            <select className="h-11 w-full rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" {...form.register("status")}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <Label>Identidade visual</Label>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-9 w-9 rounded-md bg-violet-800" />
              <div>
                <p className="text-sm font-medium text-violet-950">Roxo e branco</p>
                <p className="text-xs text-violet-950/60">Aplicado automaticamente em páginas e convites.</p>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input type="checkbox" {...form.register("permitirDuplicidadeEmail")} />
            Permitir inscrições duplicadas por e-mail
          </label>
          <div className="sm:col-span-2">
            <Label>Mensagem do convite</Label>
            <Textarea {...form.register("mensagemConvite")} />
          </div>
          <div className="sm:col-span-2">
            <Label>Mensagem de sucesso</Label>
            <Textarea {...form.register("mensagemSucesso")} />
          </div>
          <Button className="sm:col-span-2" disabled={form.formState.isSubmitting}>
            <Save className="h-4 w-4" /> Salvar evento
          </Button>
        </Card>
        <Card>
          <CardTitle>Imagens</CardTitle>
          <p className="mt-1 text-sm text-violet-950/60">Envie o banner e o logo que serão exibidos no evento e no convite.</p>
          <div className="mt-4 space-y-4">
            {event?.bannerUrl && <img src={event.bannerUrl} alt="" className="h-36 w-full rounded-md object-cover" />}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-violet-300 bg-violet-50/70 p-4 text-sm text-violet-900 transition hover:bg-violet-50">
              <ImagePlus className="h-4 w-4" /> {uploading === "banner" ? "Enviando..." : "Enviar banner"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0], "banner")} />
            </label>
            {event?.logoUrl && <img src={event.logoUrl} alt="" className="h-20 w-20 rounded-md object-cover" />}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-violet-300 bg-violet-50/70 p-4 text-sm text-violet-900 transition hover:bg-violet-50">
              <ImagePlus className="h-4 w-4" /> {uploading === "logo" ? "Enviando..." : "Enviar logo"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImage(event.target.files?.[0], "logo")} />
            </label>
          </div>
        </Card>
      </form>
    </div>
  );
}
