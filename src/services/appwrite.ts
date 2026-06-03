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

type UploadOptions = {
  imagesOnly?: boolean;
  maxMb?: number;
  onProgress?: (progress: number) => void;
};

function uploadFormData(formData: FormData, onProgress?: (progress: number) => void) {
  return new Promise<{ fileId: string; url: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", "/.netlify/functions/uploadFile");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      let result: Record<string, unknown>;
      try {
        result = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        reject(new Error("Não foi possível processar a resposta do upload."));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(typeof result.error === "string" ? result.error : "Não foi possível enviar o arquivo."));
        return;
      }
      onProgress?.(100);
      resolve({ fileId: result.fileId as string, url: result.url as string });
    };
    request.onerror = () => reject(new Error("Não foi possível enviar o arquivo."));
    request.send(formData);
  });
}

export async function uploadFile(file: File, options: UploadOptions = {}) {
  validateFile(file, options);
  options.onProgress?.(2);
  const finalFile = options.imagesOnly ? await compressImageIfPossible(file) : file;
  options.onProgress?.(8);
  const formData = new FormData();
  formData.append("fileId", crypto.randomUUID());
  formData.append("file", finalFile);

  const result = await uploadFormData(formData, options.onProgress);

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
  if (!response.ok) throw new Error(result.error || "Não foi possível excluir o arquivo.");
}

export async function updateFile(oldFileId: string | undefined, file: File, options: UploadOptions = {}) {
  const uploaded = await uploadFile(file, options);
  if (oldFileId) await deleteFile(oldFileId).catch(() => undefined);
  return uploaded;
}
