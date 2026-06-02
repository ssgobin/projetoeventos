import type { Evento } from "../types";

export type InviteTheme = {
  layout: "classic" | "highlight" | "compact";
  shape: "soft" | "straight" | "pill";
  backgroundColor: string;
  cardBackgroundColor: string;
  accentColor: string;
  titleColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  detailsBackgroundColor: string;
  codeBackgroundColor: string;
  codeTextColor: string;
  qrBackgroundColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
};

export const DEFAULT_INVITE_THEME: InviteTheme = {
  layout: "classic",
  shape: "soft",
  backgroundColor: "#f5f7fb",
  cardBackgroundColor: "#ffffff",
  accentColor: "#5b21b6",
  titleColor: "#111827",
  textColor: "#4b5563",
  mutedTextColor: "#6b7280",
  borderColor: "#e5e7eb",
  detailsBackgroundColor: "#f8fafc",
  codeBackgroundColor: "#111827",
  codeTextColor: "#ffffff",
  qrBackgroundColor: "#ffffff",
  buttonBackgroundColor: "#111827",
  buttonTextColor: "#ffffff",
};

export function normalizeInviteTheme(theme?: Evento["conviteTema"], fallbackAccent = DEFAULT_INVITE_THEME.accentColor): InviteTheme {
  return {
    ...DEFAULT_INVITE_THEME,
    accentColor: fallbackAccent || DEFAULT_INVITE_THEME.accentColor,
    buttonBackgroundColor: fallbackAccent || DEFAULT_INVITE_THEME.buttonBackgroundColor,
    ...theme,
  };
}

export function getInviteRadius(shape: InviteTheme["shape"]) {
  if (shape === "straight") return 6;
  if (shape === "pill") return 28;
  return 18;
}
