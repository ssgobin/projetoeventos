import type { Timestamp } from "firebase/firestore";

export type Role = "adminGeral" | "empresaAdmin" | "operador";
export type EventStatus = "ativo" | "inativo" | "encerrado";
export type ThemeMode = "light";
export type InviteLayout = "classic" | "highlight" | "compact";
export type InviteShape = "soft" | "straight" | "pill";
export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "cpf"
  | "date"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "terms";

export interface Empresa {
  id: string;
  nome: string;
  email: string;
  logoUrl?: string;
  logoFileId?: string;
  status: "ativa" | "inativa";
  plano?: string;
  criadoEm: Timestamp;
}

export interface Usuario {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  criadoEm: Timestamp;
}

export interface Evento {
  id: string;
  empresaId: string;
  nome: string;
  descricao: string;
  local: string;
  dataEvento: Timestamp;
  status: EventStatus;
  bannerUrl?: string;
  bannerFileId?: string;
  logoUrl?: string;
  logoFileId?: string;
  corPrincipal: string;
  tema: ThemeMode;
  permitirDuplicidadeEmail: boolean;
  capacidade?: number;
  listaEsperaAtiva?: boolean;
  mensagemConvite: string;
  mensagemSucesso: string;
  conviteTema?: {
    layout?: InviteLayout;
    shape?: InviteShape;
    backgroundColor?: string;
    cardBackgroundColor?: string;
    accentColor?: string;
    titleColor?: string;
    textColor?: string;
    mutedTextColor?: string;
    borderColor?: string;
    detailsBackgroundColor?: string;
    codeBackgroundColor?: string;
    codeTextColor?: string;
    qrBackgroundColor?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
  };
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

export interface CampoFormulario {
  id: string;
  label: string;
  name: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  ordem: number;
}

export interface Formulario {
  id: string;
  empresaId: string;
  eventoId: string;
  titulo: string;
  descricao: string;
  headerImageUrl?: string;
  headerImageFileId?: string;
  campos: CampoFormulario[];
  emailObrigatorio?: boolean;
  publicado: boolean;
  tema: {
    corPrincipal: string;
    modo: ThemeMode;
    backgroundColor?: string;
    cardBackgroundColor?: string;
    titleColor?: string;
    textColor?: string;
    labelColor?: string;
    inputBackgroundColor?: string;
    inputTextColor?: string;
    inputBorderColor?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
  };
  atualizadoEm: Timestamp;
}

export interface InscricaoArquivo {
  campoId: string;
  fileId: string;
  url: string;
  nome: string;
}

export interface Inscricao {
  id: string;
  empresaId: string;
  eventoId: string;
  email: string;
  respostas: Record<string, unknown>;
  arquivos?: InscricaoArquivo[];
  qrToken: string;
  codigoConvite: string;
  statusInscricao?: "confirmado" | "espera";
  checkin: {
    realizado: boolean;
    dataHora?: Timestamp;
    operadorId?: string;
  };
  emailEnviado: boolean;
  emailStatus?: "pendente" | "enviado" | "falhou";
  emailErro?: string;
  emailEnviadoEm?: Timestamp;
  emailFalhouEm?: Timestamp;
  criadoEm: Timestamp;
}

export interface LogAuditoria {
  id: string;
  empresaId: string;
  usuarioId: string;
  acao: string;
  detalhes?: Record<string, unknown>;
  dataHora: Timestamp;
}
