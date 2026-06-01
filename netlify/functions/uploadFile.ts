import { appwriteConfig, appwritePreviewUrl, getAppwriteHeaders, jsonResponse } from "./_appwrite";

type AppwriteFileResponse = {
  $id?: string;
  name?: string;
  message?: string;
};

export async function handler(event: { body?: string; headers: Record<string, string | undefined>; isBase64Encoded?: boolean; httpMethod?: string }) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, { ok: true });
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Metodo nao permitido" });

  try {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType?.includes("multipart/form-data")) return jsonResponse(400, { error: "Envie multipart/form-data." });
    if (!event.body) return jsonResponse(400, { error: "Arquivo obrigatorio." });

    const body = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
    const response = await fetch(`${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.bucketId}/files`, {
      method: "POST",
      headers: getAppwriteHeaders(contentType),
      body,
    });

    const data = await response.json().catch(() => ({})) as AppwriteFileResponse;
    if (!response.ok) {
      return jsonResponse(response.status, { error: data.message || "Falha ao enviar arquivo para o Appwrite." });
    }
    if (!data.$id) return jsonResponse(502, { error: "Appwrite nao retornou o ID do arquivo." });

    return jsonResponse(200, {
      fileId: data.$id,
      url: appwritePreviewUrl(data.$id),
      nome: data.name || "arquivo",
    });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Falha no upload." });
  }
}
