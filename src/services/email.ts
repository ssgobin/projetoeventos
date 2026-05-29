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

export function resendInviteEmail(inscricao: Inscricao, token: string) {
  return postFunction<{ ok: boolean }>("resendInviteEmail", { inscricaoId: inscricao.id }, token);
}

export function validateCheckin(qrToken: string, eventoId: string, token: string) {
  return postFunction<{ status: string; inscricao?: Inscricao }>("validateCheckin", { qrToken, eventoId }, token);
}

export function confirmCheckin(inscricaoId: string, token: string) {
  return postFunction<{ ok: boolean }>("validateCheckin", { inscricaoId, confirmar: true }, token);
}
