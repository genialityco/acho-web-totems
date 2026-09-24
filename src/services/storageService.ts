import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebaseConfig";

export const MAX_PAPER_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_EVENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SCREENSAVER_MEDIA_BYTES = 150 * 1024 * 1024;

const sanitizeFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.]+/g, "-")
    .replace(/-+/g, "-");

export interface UploadHandle {
  promise: Promise<string>;
  cancel: () => void;
}

// Sube el PDF de un paper a Storage y resuelve con su URL de descarga pública.
export const uploadPaperPdf = (eventSlug: string, file: File, onProgress?: (percent: number) => void): UploadHandle => {
  const path = `events/${eventSlug}/papers/${Date.now()}-${sanitizeFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: "application/pdf" });

  const promise = new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject)
    );
  });

  return { promise, cancel: () => task.cancel() };
};

// Borra un archivo previamente subido a Storage a partir de su URL de descarga.
// No falla si la URL no apunta a este bucket (por ejemplo, un enlace externo cargado antes de esta función).
const deleteStorageFile = async (downloadUrl: string): Promise<void> => {
  try {
    await deleteObject(ref(storage, downloadUrl));
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "storage/invalid-argument") {
      return;
    }
    throw error;
  }
};

export const deletePaperPdf = deleteStorageFile;

export type EventImageKind = "banner" | "background";

// Sube el banner o la imagen de fondo de un evento y resuelve con su URL de descarga pública.
export const uploadEventImage = (
  eventSlug: string,
  kind: EventImageKind,
  file: File,
  onProgress?: (percent: number) => void
): UploadHandle => {
  const path = `events/${eventSlug}/images/${kind}-${Date.now()}-${sanitizeFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });

  const promise = new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject)
    );
  });

  return { promise, cancel: () => task.cancel() };
};

export const deleteEventImage = deleteStorageFile;

// Sube una foto o video del protector de pantalla y resuelve con su URL de descarga pública.
export const uploadScreensaverMedia = (
  eventSlug: string,
  type: "image" | "video",
  file: File,
  onProgress?: (percent: number) => void
): UploadHandle => {
  const path = `events/${eventSlug}/screensaver/${type}-${Date.now()}-${sanitizeFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });

  const promise = new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject)
    );
  });

  return { promise, cancel: () => task.cancel() };
};

export const deleteScreensaverMedia = deleteStorageFile;
