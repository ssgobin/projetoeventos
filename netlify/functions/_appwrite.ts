const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "6a199b240039ee847a5e";
const APPWRITE_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "6a199b38001ad007a77a";

export const appwriteConfig = {
  endpoint: APPWRITE_ENDPOINT.replace(/\/$/, ""),
  projectId: APPWRITE_PROJECT_ID,
  bucketId: APPWRITE_BUCKET_ID,
};

export function getAppwriteHeaders(contentType?: string) {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!apiKey) throw new Error("APPWRITE_API_KEY nao configurada nas variaveis de ambiente.");

  return {
    "X-Appwrite-Project": appwriteConfig.projectId,
    "X-Appwrite-Key": apiKey,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

export function appwritePreviewUrl(fileId: string) {
  return `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.bucketId}/files/${fileId}/preview?width=1600&height=900&project=${appwriteConfig.projectId}`;
}

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
