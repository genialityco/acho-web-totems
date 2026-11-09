import { collection, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "../firebaseConfig";

// ready: embedding con el texto del PDF. partial: el PDF no aportó texto y el embedding salió solo del
// título y los campos (el paper igual participa en la búsqueda conceptual). unsupported: estado de la
// versión anterior del indexado (PDF sin texto, sin embedding); el reintento diario lo migra a partial.
export type PaperSearchIndexStatus = "pending" | "processing" | "ready" | "partial" | "error" | "unsupported";

export interface PaperSearchIndex {
  paperId: string;
  status: PaperSearchIndexStatus;
  urlPdf: string;
  extractedText: string;
  textLength: number;
  embedding: number[] | null;
  embeddingModel: string | null;
  embeddingDim: number | null;
  error: string | null;
  // Mensaje del último intento de indexado fallido (null si el último funcionó). En un índice
  // "ready"/"partial" significa que se conservó el índice anterior.
  lastError: string | null;
  updatedAt: Date | null;
}

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const STATUSES: PaperSearchIndexStatus[] = ["pending", "processing", "ready", "partial", "error", "unsupported"];

// Un índice participa en la búsqueda conceptual si tiene embedding, sea cual sea su estado: mientras
// se re-indexa, o si una falla pasajera dejó "error", se sigue usando el embedding anterior del mismo PDF.
export const hasEmbedding = (index: PaperSearchIndex | undefined): index is PaperSearchIndex & { embedding: number[] } =>
  !!index?.embedding && index.embedding.length > 0;

// Índice de búsqueda (texto extraído + embedding) generado por la Cloud
// Function indexPaperSearch; solo lectura desde el cliente (ver firestore.rules).
export const subscribePaperSearchIndex = (
  slug: string,
  onData: (items: PaperSearchIndex[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "paperSearchIndex"),
    (snap) => {
      onData(
        snap.docs.map((d): PaperSearchIndex => {
          const data = d.data();
          const status = asString(data.status);
          return {
            paperId: d.id,
            status: STATUSES.includes(status as PaperSearchIndexStatus)
              ? (status as PaperSearchIndexStatus)
              : "pending",
            urlPdf: asString(data.urlPdf),
            extractedText: asString(data.extractedText),
            textLength: typeof data.textLength === "number" ? data.textLength : 0,
            embedding: Array.isArray(data.embedding)
              ? data.embedding.filter((n): n is number => typeof n === "number")
              : null,
            embeddingModel: asString(data.embeddingModel) || null,
            embeddingDim: typeof data.embeddingDim === "number" ? data.embeddingDim : null,
            error: asString(data.error) || null,
            lastError: asString(data.lastError) || null,
            updatedAt: typeof data.updatedAt?.toDate === "function" ? data.updatedAt.toDate() : null,
          };
        })
      );
    },
    onError
  );
