import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal.");

const inviteThemeSchema = z.object({
  layout: z.enum(["classic", "highlight", "compact"]),
  shape: z.enum(["soft", "straight", "pill"]),
  backgroundColor: hexColorSchema,
  cardBackgroundColor: hexColorSchema,
  accentColor: hexColorSchema,
  titleColor: hexColorSchema,
  textColor: hexColorSchema,
  mutedTextColor: hexColorSchema,
  borderColor: hexColorSchema,
  detailsBackgroundColor: hexColorSchema,
  codeBackgroundColor: hexColorSchema,
  codeTextColor: hexColorSchema,
  qrBackgroundColor: hexColorSchema,
  buttonBackgroundColor: hexColorSchema,
  buttonTextColor: hexColorSchema,
});

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export const registerSchema = loginSchema.extend({
  nomeEmpresa: z.string().min(2, "Informe o nome da empresa."),
  nomeUsuario: z.string().min(2, "Informe seu nome."),
});

export const eventSchema = z.object({
  nome: z.string().min(3, "Informe um nome com pelo menos 3 caracteres."),
  descricao: z.string().min(8, "Descreva o evento."),
  local: z.string().min(3, "Informe o local."),
  dataEvento: z.string().min(1, "Informe data e hora."),
  status: z.enum(["ativo", "inativo", "encerrado"]),
  corPrincipal: hexColorSchema,
  tema: z.literal("light"),
  permitirDuplicidadeEmail: z.boolean(),
});

export const inviteSchema = z.object({
  mensagemConvite: z.string().min(5, "Informe a mensagem do convite."),
  mensagemSucesso: z.string().min(5, "Informe a mensagem de sucesso."),
  conviteTema: inviteThemeSchema,
});

export const fieldSchema = z.object({
  label: z.string().min(2, "Informe o rótulo."),
  name: z.string().min(2, "Informe o identificador."),
  type: z.enum(["text", "textarea", "email", "tel", "cpf", "date", "number", "select", "radio", "checkbox", "file", "terms"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  optionsText: z.string().optional(),
});
