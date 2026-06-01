import { appwriteConfig, getAppwriteHeaders } from "./_appwrite";

export async function handler(event: { queryStringParameters?: Record<string, string | undefined>; httpMethod?: string }) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Metodo nao permitido" }),
    };
  }

  try {
    const fileId = event.queryStringParameters?.fileId;
    const mode = "view";
    if (!fileId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "fileId obrigatorio." }),
      };
    }

    const response = await fetch(`${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.bucketId}/files/${encodeURIComponent(fileId)}/${mode}`, {
      headers: getAppwriteHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data.message || "Falha ao carregar arquivo." }),
      };
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Falha ao carregar arquivo." }),
    };
  }
}
