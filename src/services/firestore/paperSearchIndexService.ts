import { collection, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "../firebaseConfig";

export type PaperSearchIndexStatus = "pending" | "processing" | "ready" | "error" | "unsupported";

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
  updatedAt: Date | null;
}

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const STATUSES: PaperSearchIndexStatus[] = ["pending", "processing", "ready", "error", "unsupported"];

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
            updatedAt: typeof data.updatedAt?.toDate === "function" ? data.updatedAt.toDate() : null,
          };
        })
      );
    },
    onError
  );
