import { appwriteConfig, getAppwriteHeaders, jsonResponse } from "./_appwrite";

type AppwriteErrorResponse = {
  message?: string;
};

export async function handler(event: { body?: string; httpMethod?: string }) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, { ok: true });
  if (event.httpMethod !== "DELETE" && event.httpMethod !== "POST") return jsonResponse(405, { error: "Metodo nao permitido" });

  try {
    const { fileId } = JSON.parse(event.body || "{}");
    if (!fileId) return jsonResponse(400, { error: "fileId obrigatorio." });

    const response = await fetch(`${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.bucketId}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: getAppwriteHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as AppwriteErrorResponse;
      return jsonResponse(response.status, { error: data.message || "Falha ao excluir arquivo no Appwrite." });
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Falha ao excluir arquivo." });
  }
}
