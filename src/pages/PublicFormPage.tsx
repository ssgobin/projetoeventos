import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { CheckCircle2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/input";
import { uploadFile } from "../services/appwrite";
import { sendInviteEmail } from "../services/email";
import { db } from "../services/firebase";
import type { CampoFormulario, Evento, Formulario, InscricaoArquivo } from "../types";
import { isValidCpf, makeInviteCode, makeToken, sanitizeText } from "../utils/security";

function makePublicSignupId(eventoId: string, email: string) {
  return `${eventoId}_${encodeURIComponent(email).replace(/[.%/[\]#?]/g, "_")}`;
}

export default function PublicFormPage() {
  const { eventoId } = useParams();
  const [event, setEvent] = useState<Evento | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ code: string; token: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventoId) return;
    Promise.all([getDoc(doc(db, "eventos", eventoId)), getDoc(doc(db, "formularios", eventoId))]).then(([eventSnap, formSnap]) => {
      if (eventSnap.exists()) setEvent({ id: eventSnap.id, ...eventSnap.data() } as Evento);
      if (formSnap.exists()) setFormulario({ id: formSnap.id, ...formSnap.data() } as Formulario);
    });
  }, [eventoId]);

  const emailField = useMemo(() => formulario?.campos.find((field) => field.type === "email" && field.required), [formulario]);

  function validate(campos: CampoFormulario[]) {
    if (!emailField) return "Formulário indisponível: falta e-mail obrigatório.";
    for (const field of campos) {
      const value = values[field.name];
      if (field.required && field.type !== "file" && (value === undefined || value === "" || value === false)) return `Preencha ${field.label}.`;
      if (field.required && field.type === "file" && !files[field.id]) return `Envie o arquivo de ${field.label}.`;
      if (field.type === "email" && value && !String(value).match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return "Informe um e-mail válido.";
      if (field.type === "cpf" && value && !isValidCpf(String(value))) return "Informe um CPF válido.";
    }
    return "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!formulario || !event) return;
    const validation = validate(formulario.campos);
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const email = String(values[emailField!.name]).toLowerCase().trim();
      const arquivos: InscricaoArquivo[] = [];
      for (const [campoId, file] of Object.entries(files)) {
        const uploaded = await uploadFile(file, { maxMb: 8 });
        arquivos.push({ campoId, fileId: uploaded.fileId, url: uploaded.url, nome: uploaded.nome });
      }
      const qrToken = makeToken();
      const codigoConvite = makeInviteCode();
      const respostas = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? sanitizeText(value) : value]));
      const payload = {
        empresaId: event.empresaId,
        eventoId: event.id,
        email,
        respostas,
        arquivos,
        qrToken,
        codigoConvite,
        checkin: { realizado: false },
        emailEnviado: false,
        criadoEm: serverTimestamp(),
      };
      const ref = event.permitirDuplicidadeEmail
        ? await addDoc(collection(db, "inscricoes"), payload)
        : doc(db, "inscricoes", makePublicSignupId(event.id, email));

      if (!event.permitirDuplicidadeEmail) await setDoc(ref, payload);

      sendInviteEmail(ref.id).catch(() => undefined);
      setSuccess({ code: codigoConvite, token: qrToken });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("permissions") ? "Este e-mail já está inscrito neste evento." : message || "Não foi possível concluir a inscrição.");
    } finally {
      setLoading(false);
    }
  }

  if (!event || !formulario) return <main className="flex min-h-screen items-center justify-center bg-violet-50 text-violet-950">Carregando...</main>;
  if (!formulario.publicado || event.status !== "ativo") return <main className="flex min-h-screen items-center justify-center bg-violet-50 text-violet-950">Formulário indisponível.</main>;

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-violet-50 p-6">
        <Card className="max-w-lg animate-scale-in text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-violet-700" />
          <h1 className="mt-4 text-2xl font-medium">{event.mensagemSucesso}</h1>
          <p className="mt-2 text-sm text-violet-950/60">Guarde o código abaixo. O QR Code também foi enviado para o seu e-mail.</p>
          <div className="mx-auto mt-5 w-fit rounded-lg bg-white p-3 ring-1 ring-violet-200">
            <QRCodeCanvas value={success.token} size={180} />
          </div>
          <p className="mt-4 rounded-md bg-violet-100 px-4 py-3 font-mono text-lg tracking-widest text-violet-950">{success.code}</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-violet-50 px-4 py-8">
      <Card className="mx-auto max-w-2xl animate-fade-up overflow-hidden p-0">
        {(formulario.headerImageUrl || event.bannerUrl) && <img src={formulario.headerImageUrl || event.bannerUrl} className="h-56 w-full object-cover" alt="" />}
        <form className="p-6" onSubmit={submit}>
          {event.logoUrl && <img src={event.logoUrl} className="mb-4 h-14 w-14 rounded-md object-cover" alt="" />}
          <h1 className="text-3xl font-medium text-violet-950">{formulario.titulo}</h1>
          <p className="mt-2 text-violet-950/60">{formulario.descricao}</p>
          <div className="mt-6 space-y-4">
            {[...formulario.campos].sort((a, b) => a.ordem - b.ordem).map((field) => (
              <DynamicField key={field.id} field={field} value={values[field.name]} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} onFile={(file) => setFiles((current) => ({ ...current, [field.id]: file }))} />
            ))}
          </div>
          {error && <p className="mt-4 rounded-md bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-800">{error}</p>}
          <Button className="mt-6 w-full" disabled={loading}>{loading ? "Enviando..." : "Confirmar inscrição"}</Button>
        </form>
      </Card>
    </main>
  );
}

function DynamicField({ field, value, onChange, onFile }: { field: CampoFormulario; value: unknown; onChange: (value: unknown) => void; onFile: (file: File) => void }) {
  const common = <Label>{field.label}{field.required ? " *" : ""}</Label>;
  if (field.type === "textarea") return <div>{common}<Textarea placeholder={field.placeholder} value={String(value || "")} onChange={(e) => onChange(e.target.value)} /></div>;
  if (field.type === "select") return <div>{common}<select className="h-11 w-full rounded-md border border-violet-200 bg-white px-3 text-sm text-violet-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" value={String(value || "")} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "radio") return <div>{common}<div className="space-y-2">{field.options?.map((option) => <label key={option} className="flex gap-2 text-sm"><input type="radio" name={field.id} onChange={() => onChange(option)} />{option}</label>)}</div></div>;
  if (field.type === "checkbox") return <div>{common}<div className="space-y-2">{field.options?.map((option) => <label key={option} className="flex gap-2 text-sm"><input type="checkbox" onChange={(e) => { const list = Array.isArray(value) ? value as string[] : []; onChange(e.target.checked ? [...list, option] : list.filter((item) => item !== option)); }} />{option}</label>)}</div></div>;
  if (field.type === "terms") return <label className="flex gap-2 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />{field.label}</label>;
  if (field.type === "file") return <div>{common}<Input type="file" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></div>;
  return <div>{common}<Input type={field.type === "cpf" ? "text" : field.type} placeholder={field.placeholder} value={String(value || "")} onChange={(e) => onChange(e.target.value)} /></div>;
}
