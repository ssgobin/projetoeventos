import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { UploadProgress } from "../components/ui/upload-progress";
import { getFilePreview, uploadFile } from "../services/appwrite";
import { createPublicSignup, sendInviteEmail } from "../services/email";
import { db } from "../services/firebase";
import type { CampoFormulario, Evento, Formulario, InscricaoArquivo } from "../types";
import { getInviteRadius, normalizeInviteTheme } from "../utils/inviteTheme";
import { isValidCpf, sanitizeText } from "../utils/security";

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

function normalizeTheme(theme?: Partial<Formulario["tema"]>): Formulario["tema"] {
  return { ...DEFAULT_FORM_THEME, ...theme, modo: "light" };
}

export default function PublicFormPage() {
  const { eventoId } = useParams();
  const [event, setEvent] = useState<Evento | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; code: string; token: string; statusInscricao: "confirmado" | "espera" } | null>(null);
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
        setUploadProgress((current) => ({ ...current, [campoId]: 0 }));
        const uploaded = await uploadFile(file, {
          maxMb: 8,
          onProgress: (progress) => setUploadProgress((current) => ({ ...current, [campoId]: progress })),
        });
        arquivos.push({ campoId, fileId: uploaded.fileId, url: uploaded.url, nome: uploaded.nome });
        setUploadProgress((current) => {
          const next = { ...current };
          delete next[campoId];
          return next;
        });
      }
      const respostas = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? sanitizeText(value) : value]));
      const signup = await createPublicSignup({
        eventoId: event.id,
        email,
        respostas,
        arquivos,
      });

      sendInviteEmail(signup.inscricaoId).catch(() => undefined);
      setSuccess({ id: signup.inscricaoId, code: signup.codigoConvite, token: signup.qrToken, statusInscricao: signup.statusInscricao });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("permissions") ? "Este e-mail já está inscrito neste evento." : message || "Não foi possível concluir a inscrição.");
    } finally {
      setUploadProgress({});
      setLoading(false);
    }
  }

  if (!event || !formulario) return <main className="flex min-h-screen items-center justify-center bg-violet-50 text-violet-950">Carregando...</main>;
  const theme = normalizeTheme(formulario.tema);
  const inviteTheme = normalizeInviteTheme(event.conviteTema, event.corPrincipal);
  if (!formulario.publicado || event.status !== "ativo") return <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: theme.backgroundColor, color: theme.titleColor }}>Formulário indisponível.</main>;

  if (success) {
    const inviteRadius = getInviteRadius(inviteTheme.shape);
    const compact = inviteTheme.layout === "compact";
    const logoSrc = event.logoFileId ? getFilePreview(event.logoFileId) : event.logoUrl;
    return (
      <main className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: inviteTheme.backgroundColor }}>
        <Card className="max-w-lg animate-scale-in overflow-hidden p-0 text-center" style={{ backgroundColor: inviteTheme.cardBackgroundColor, borderColor: inviteTheme.borderColor, borderRadius: inviteRadius }}>
          {inviteTheme.layout === "highlight" && <div className="h-3 w-full" style={{ backgroundColor: inviteTheme.accentColor }} />}
          <div className={compact ? "p-6" : "p-8"}>
            {logoSrc ? (
              <img src={logoSrc} alt="" className="mx-auto h-14 w-14 object-cover" style={{ borderRadius: Math.max(inviteRadius - 8, 4) }} />
            ) : (
              <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: inviteTheme.buttonBackgroundColor }} />
            )}
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: inviteTheme.accentColor }}>Convite confirmado</p>
            <h1 className="mt-2 text-2xl font-medium" style={{ color: inviteTheme.titleColor }}>{success.statusInscricao === "espera" ? "Você entrou na lista de espera." : event.mensagemSucesso}</h1>
            <p className="mt-2 text-sm" style={{ color: inviteTheme.textColor }}>
              {success.statusInscricao === "espera" ? "Guardamos seus dados e avisaremos quando uma vaga for liberada." : "Guarde o código abaixo. O QR Code também foi enviado para o seu e-mail."}
            </p>
            <div className="mx-auto mt-5 w-fit p-3 ring-1" style={{ backgroundColor: inviteTheme.qrBackgroundColor, borderColor: inviteTheme.borderColor, borderRadius: Math.max(inviteRadius - 6, 4) }}>
              <QRCodeCanvas value={success.token} size={180} />
            </div>
            <p className="mt-4 px-4 py-3 font-mono text-lg tracking-widest" style={{ backgroundColor: inviteTheme.codeBackgroundColor, color: inviteTheme.codeTextColor, borderRadius: Math.max(inviteRadius - 8, 4) }}>{success.code}</p>
            <Button asChild className="mt-5" style={{ backgroundColor: inviteTheme.buttonBackgroundColor, color: inviteTheme.buttonTextColor }}>
              <a href={`/convite/${encodeURIComponent(success.id)}/${encodeURIComponent(success.token)}`}>Abrir convite</a>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8" style={{ backgroundColor: theme.backgroundColor }}>
      <Card className="mx-auto max-w-2xl animate-fade-up overflow-hidden p-0" style={{ backgroundColor: theme.cardBackgroundColor, borderColor: theme.inputBorderColor }}>
        {(formulario.headerImageFileId || formulario.headerImageUrl || event.bannerFileId || event.bannerUrl) && <img src={formulario.headerImageFileId ? getFilePreview(formulario.headerImageFileId) : formulario.headerImageUrl || (event.bannerFileId ? getFilePreview(event.bannerFileId) : event.bannerUrl)} className="h-56 w-full object-cover" alt="" />}
        <form className="p-6" onSubmit={submit}>
          {(event.logoFileId || event.logoUrl) && <img src={event.logoFileId ? getFilePreview(event.logoFileId) : event.logoUrl} className="mb-4 h-14 w-14 rounded-md object-cover" alt="" />}
          <h1 className="text-3xl font-medium" style={{ color: theme.titleColor }}>{formulario.titulo}</h1>
          <p className="mt-2" style={{ color: theme.textColor }}>{formulario.descricao}</p>
          <div className="mt-6 space-y-4">
            {[...formulario.campos].sort((a, b) => a.ordem - b.ordem).map((field) => (
              <DynamicField key={field.id} field={field} theme={theme} value={values[field.name]} selectedFile={files[field.id]} uploadProgress={uploadProgress[field.id]} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} onFile={(file) => setFiles((current) => ({ ...current, [field.id]: file }))} />
            ))}
          </div>
          {error && <p className="mt-4 rounded-md bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-800">{error}</p>}
          <Button className="mt-6 w-full" disabled={loading} style={{ backgroundColor: theme.buttonBackgroundColor, color: theme.buttonTextColor }}>{loading ? "Enviando..." : "Confirmar inscrição"}</Button>
        </form>
      </Card>
    </main>
  );
}

function DynamicField({ field, theme, value, selectedFile, uploadProgress, onChange, onFile }: { field: CampoFormulario; theme: Formulario["tema"]; value: unknown; selectedFile?: File; uploadProgress?: number; onChange: (value: unknown) => void; onFile: (file: File) => void }) {
  const label = <label className="mb-1.5 block text-sm font-medium" style={{ color: theme.labelColor }}>{field.label}{field.required ? " *" : ""}</label>;
  const inputStyle = { backgroundColor: theme.inputBackgroundColor, borderColor: theme.inputBorderColor, color: theme.inputTextColor };
  const optionLabelStyle = { color: theme.textColor };

  if (field.type === "textarea") return <div>{label}<Textarea placeholder={field.placeholder} value={String(value || "")} style={inputStyle} onChange={(e) => onChange(e.target.value)} /></div>;
  if (field.type === "select") return <div>{label}<select className="h-11 w-full rounded-md border px-3 text-sm outline-none transition" style={inputStyle} value={String(value || "")} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "radio") return <div>{label}<div className="space-y-2">{field.options?.map((option) => <label key={option} className="flex gap-2 text-sm" style={optionLabelStyle}><input type="radio" name={field.id} onChange={() => onChange(option)} />{option}</label>)}</div></div>;
  if (field.type === "checkbox") return <div>{label}<div className="space-y-2">{field.options?.map((option) => <label key={option} className="flex gap-2 text-sm" style={optionLabelStyle}><input type="checkbox" onChange={(e) => { const list = Array.isArray(value) ? value as string[] : []; onChange(e.target.checked ? [...list, option] : list.filter((item) => item !== option)); }} />{option}</label>)}</div></div>;
  if (field.type === "terms") return <label className="flex gap-2 text-sm" style={optionLabelStyle}><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />{field.label}</label>;
  if (field.type === "file") return (
    <div>
      {label}
      <Input type="file" style={inputStyle} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {selectedFile && uploadProgress === undefined && <p className="mt-2 text-xs" style={{ color: theme.textColor }}>{selectedFile.name}</p>}
      {uploadProgress !== undefined && <div className="mt-2"><UploadProgress label={`Enviando ${selectedFile?.name || field.label}`} progress={uploadProgress} /></div>}
    </div>
  );
  return <div>{label}<Input type={field.type === "cpf" ? "text" : field.type} placeholder={field.placeholder} value={String(value || "")} style={inputStyle} onChange={(e) => onChange(e.target.value)} /></div>;
}
