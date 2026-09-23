import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { commitRowsInChunks } from "./batch";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  institution: string;
  urlPdf: string;
  categoryId: string | null;
  theme: string | null;
  voteCount: number;
}

// voteCount no forma parte de la entrada: solo lo escriben las Cloud Functions.
export type PaperInput = Omit<Paper, "id" | "voteCount">;

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
          categoryId: asString(data.categoryId) || null,
          theme: asString(data.theme) || null,
          voteCount: typeof data.voteCount === "number" ? data.voteCount : 0,
        };
      });
      papers.sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }));
      onData(papers);
    },
    onError
  );

export const createPaper = async (slug: string, input: PaperInput) => {
  await addDoc(collection(db, "events", slug, "papers"), { ...input, voteCount: 0 });
};

export const updatePaper = (slug: string, id: string, input: PaperInput) =>
  updateDoc(doc(db, "events", slug, "papers", id), input);

export const deletePaper = (slug: string, id: string) =>
  deleteDoc(doc(db, "events", slug, "papers", id));

export const importPapers = (slug: string, inputs: PaperInput[]) =>
  commitRowsInChunks(inputs, (batch, input) =>
    batch.set(doc(collection(db, "events", slug, "papers")), { ...input, voteCount: 0 })
  );
