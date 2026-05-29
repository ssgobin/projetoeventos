import { Client, ID, Storage } from "appwrite";
import imageCompression from "browser-image-compression";

const appwriteConfig = {
  endpoint: "https://nyc.cloud.appwrite.io/v1",
  projectId: "6a199b240039ee847a5e",
  bucketId: "6a199b38001ad007a77a",
};

const client = new Client().setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.projectId);
const storage = new Storage(client);

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
  return imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1800, useWebWorker: true });
}

export async function uploadFile(file: File, options: { imagesOnly?: boolean; maxMb?: number } = {}) {
  validateFile(file, options);
  const finalFile = options.imagesOnly ? await compressImageIfPossible(file) : file;
  const result = await storage.createFile(appwriteConfig.bucketId, ID.unique(), finalFile);
  return { fileId: result.$id, url: getFilePreview(result.$id), nome: file.name };
}

export function getFilePreview(fileId: string) {
  return storage.getFilePreview(appwriteConfig.bucketId, fileId, 1600, 900).toString();
}

export function getFileView(fileId: string) {
  return storage.getFileView(appwriteConfig.bucketId, fileId).toString();
}

export async function deleteFile(fileId: string) {
  await storage.deleteFile(appwriteConfig.bucketId, fileId);
}

export async function updateFile(oldFileId: string | undefined, file: File, options: { imagesOnly?: boolean; maxMb?: number } = {}) {
  const uploaded = await uploadFile(file, options);
  if (oldFileId) await deleteFile(oldFileId).catch(() => undefined);
  return uploaded;
}
