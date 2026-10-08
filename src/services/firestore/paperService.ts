import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebaseConfig";
import { commitRowsInChunks } from "./batch";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  institution: string;
  urlPdf: string;
  // Video opcional y complementario al PDF (ver storageService.uploadPaperVideo); no participa
  // en el indexado de búsqueda semántica (solo se procesa texto de PDF, ver indexPaperSearchTrigger),
  // pero el paper sigue apareciendo en búsqueda exacta por título/autores como cualquier otro.
  urlVideo: string | null;
  categoryId: string | null;
  theme: string | null;
  // Tipo de estudio (opcional): uno de los EventInfo.studyTypes del evento, guardado por nombre.
  studyType: string | null;
  year: number | null;
  country: string | null;
  identificationCode: string | null;
  voteCount: number;
  // Métricas propias (independientes de Google Analytics), incrementadas por la Cloud Function
  // incrementPaperMetric desde el sitio público: cuántas veces se abrió el detalle del póster y
  // cuántas se le dio a "Descargar".
  viewCount: number;
  downloadCount: number;
}

// voteCount/viewCount/downloadCount no forman parte de la entrada: solo los escriben las Cloud Functions.
export type PaperInput = Omit<Paper, "id" | "voteCount" | "viewCount" | "downloadCount">;

const asString = (value: unknown) => (typeof value === "string" ? value : "");

// Los autores se separan por saltos de línea o punto y coma.
export const parseAuthors = (text: string) =>
  text
    .split(/[\n;]/)
    .map((author) => author.trim())
    .filter(Boolean);

export const subscribePapers = (
  slug: string,
  onData: (papers: Paper[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "papers"),
    (snap) => {
      const papers = snap.docs.map((d): Paper => {
        const data = d.data();
        return {
          id: d.id,
          title: asString(data.title),
          authors: Array.isArray(data.authors)
            ? data.authors.filter((a): a is string => typeof a === "string")
            : [],
          institution: asString(data.institution),
          urlPdf: asString(data.urlPdf),
          urlVideo: asString(data.urlVideo) || null,
          categoryId: asString(data.categoryId) || null,
          theme: asString(data.theme) || null,
          studyType: asString(data.studyType) || null,
          year: typeof data.year === "number" ? data.year : null,
          country: asString(data.country) || null,
          identificationCode: asString(data.identificationCode) || null,
          voteCount: typeof data.voteCount === "number" ? data.voteCount : 0,
          viewCount: typeof data.viewCount === "number" ? data.viewCount : 0,
          downloadCount: typeof data.downloadCount === "number" ? data.downloadCount : 0,
        };
      });
      papers.sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }));
      onData(papers);
    },
    onError
  );

export const createPaper = async (slug: string, input: PaperInput) => {
  await addDoc(collection(db, "events", slug, "papers"), { ...input, voteCount: 0, viewCount: 0, downloadCount: 0 });
};

export const updatePaper = (slug: string, id: string, input: PaperInput) =>
  updateDoc(doc(db, "events", slug, "papers", id), input);

export const deletePaper = (slug: string, id: string) =>
  deleteDoc(doc(db, "events", slug, "papers", id));

export const importPapers = (slug: string, inputs: PaperInput[]) =>
  commitRowsInChunks(inputs, (batch, input) =>
    batch.set(doc(collection(db, "events", slug, "papers")), { ...input, voteCount: 0, viewCount: 0, downloadCount: 0 })
  );

const mergeDuplicatePaperCallable = httpsCallable<
  { eventSlug: string; keepPaperId: string; removePaperId: string },
  { ok: boolean; votesMoved: number }
>(functions, "mergeDuplicatePaper");

// Fusiona un paper duplicado (removePaperId) en otro (keepPaperId): suma votos/vistas/descargas,
// reasigna los votos individuales y borra el duplicado (admin-only, ver mergeDuplicatePaper).
export const mergeDuplicatePaper = async (eventSlug: string, keepPaperId: string, removePaperId: string) =>
  (await mergeDuplicatePaperCallable({ eventSlug, keepPaperId, removePaperId })).data;
