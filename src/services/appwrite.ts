import imageCompression from "browser-image-compression";

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const fileTypes = [...imageTypes, "application/pdf"];

export function validateFile(file: File, options: { maxMb?: number; imagesOnly?: boolean } = {}) {
  const maxMb = options.maxMb ?? 8;
  const allowed = options.imagesOnly ? imageTypes : fileTypes;
  if (!allowed.includes(file.type)) throw new Error(options.imagesOnly ? "Use uma imagem JPG, PNG, WEBP ou GIF." : "Tipo de arquivo não permitido.");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`O arquivo precisa ter no máximo ${maxMb}MB.`);
}

export async function compressImageIfPossible(file: File) {
  if (!imageTypes.includes(file.type) || file.type === "image/gif") return file;
  const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1800, useWebWorker: true });
  return compressed instanceof File ? compressed : new File([compressed], file.name, { type: file.type, lastModified: Date.now() });
}

export async function uploadFile(file: File, options: { imagesOnly?: boolean; maxMb?: number } = {}) {
  validateFile(file, options);
  const finalFile = options.imagesOnly ? await compressImageIfPossible(file) : file;
  const formData = new FormData();
  formData.append("fileId", crypto.randomUUID());
  formData.append("file", finalFile);

  const response = await fetch("/.netlify/functions/uploadFile", {
    method: "POST",
    body: formData,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Nao foi possivel enviar o arquivo.");

  return { fileId: result.fileId as string, url: result.url as string, nome: file.name };
}

export function getFilePreview(fileId: string) {
  return `/.netlify/functions/viewFile?fileId=${encodeURIComponent(fileId)}&mode=preview`;
}

export function getFileView(fileId: string) {
  return `/.netlify/functions/viewFile?fileId=${encodeURIComponent(fileId)}&mode=view`;
}

export async function deleteFile(fileId: string) {
  const response = await fetch("/.netlify/functions/deleteFile", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Nao foi possivel excluir o arquivo.");
}

export async function updateFile(oldFileId: string | undefined, file: File, options: { imagesOnly?: boolean; maxMb?: number } = {}) {
  const uploaded = await uploadFile(file, options);
  if (oldFileId) await deleteFile(oldFileId).catch(() => undefined);
  return uploaded;
}
