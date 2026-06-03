import type { Inscricao } from "../types";

async function postFunction<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`/.netlify/functions/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Não foi possível concluir a operação.");
  }
  return response.json();
}

export function sendInviteEmail(inscricaoId: string) {
  return postFunction<{ ok: boolean }>("sendInviteEmail", { inscricaoId });
}

export function createPublicSignup(payload: { eventoId: string; email: string; respostas: Record<string, unknown>; arquivos: unknown[] }) {
  return postFunction<{ inscricaoId: string; qrToken: string; codigoConvite: string; statusInscricao: "confirmado" | "espera" }>("publicSignup", payload);
}

export function resendInviteEmail(inscricao: Inscricao, token: string) {
  return postFunction<{ ok: boolean }>("resendInviteEmail", { inscricaoId: inscricao.id }, token);
}

export function importGuests(eventoId: string, rows: Record<string, unknown>[], sendEmails: boolean, token: string) {
  return postFunction<{
    createdIds: string[];
    skipped: Array<{ row: number; email?: string; reason: string }>;
    sent: string[];
    failed: Array<{ inscricaoId: string; error: string }>;
  }>("importGuests", { eventoId, rows, sendEmails }, token);
}

export function bulkSendInvites(eventoId: string, mode: "selected" | "pending" | "failed" | "all", inscricaoIds: string[], token: string) {
  return postFunction<{ sent: string[]; failed: Array<{ inscricaoId: string; error: string }>; total: number }>("bulkSendInvites", { eventoId, mode, inscricaoIds }, token);
}

export function validateCheckin(qrToken: string, eventoId: string, token: string) {
  return postFunction<{ status: string; inscricao?: Inscricao }>("validateCheckin", { qrToken, eventoId }, token);
}

export function confirmCheckin(inscricaoId: string, token: string) {
  return postFunction<{ ok: boolean }>("validateCheckin", { inscricaoId, confirmar: true }, token);
}

export async function getPublicInvite(inscricaoId: string, token: string) {
  const response = await fetch(`/.netlify/functions/publicInvite?inscricaoId=${encodeURIComponent(inscricaoId)}&token=${encodeURIComponent(token)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível abrir o convite.");
  return data;
}
