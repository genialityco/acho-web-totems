import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  updateDoc,
  WriteBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { commitOpsInChunks } from "./batch";

export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
}

export type CategoryInput = Omit<Category, "id">;

export const subscribeCategories = (
  slug: string,
  onData: (categories: Category[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "categories"),
    (snap) => {
      const categories = snap.docs.map((d): Category => {
        const data = d.data();
        return {
          id: d.id,
          name: typeof data.name === "string" ? data.name : d.id,
          color: typeof data.color === "string" ? data.color : "gray",
          order: typeof data.order === "number" ? data.order : 0,
        };
      });
      categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
      onData(categories);
    },
    onError
  );

export const createCategory = async (slug: string, input: CategoryInput) => {
  await addDoc(collection(db, "events", slug, "categories"), input);
};

export const updateCategory = (slug: string, id: string, input: CategoryInput) =>
  updateDoc(doc(db, "events", slug, "categories", id), input);

// Los papers de la categoría quedan sin categoría; la categoría se borra al final.
export const deleteCategory = (slug: string, id: string, paperIdsToClear: string[]) =>
  commitOpsInChunks([
    ...paperIdsToClear.map(
      (paperId) => (batch: WriteBatch) =>
        batch.update(doc(db, "events", slug, "papers", paperId), { categoryId: null })
    ),
    (batch: WriteBatch) => batch.delete(doc(db, "events", slug, "categories", id)),
  ]);
