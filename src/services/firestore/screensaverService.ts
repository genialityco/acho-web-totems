import { addDoc, collection, deleteDoc, doc, onSnapshot, Unsubscribe, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export type ScreensaverItemFit = "cover" | "contain";

export interface ScreensaverItem {
  id: string;
  type: "image" | "video";
  url: string;
  order: number;
  // Cómo encaja el contenido en la pantalla: "cover" llena la pantalla (recorta si la
  // relación de aspecto no coincide), "contain" muestra el archivo completo (con barras).
  fit: ScreensaverItemFit;
}

export type ScreensaverItemInput = Omit<ScreensaverItem, "id">;

export const subscribeScreensaverItems = (
  slug: string,
  onData: (items: ScreensaverItem[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "screensaverItems"),
    (snap) => {
      const items = snap.docs.map((d): ScreensaverItem => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type === "video" ? "video" : "image",
          url: typeof data.url === "string" ? data.url : "",
          order: typeof data.order === "number" ? data.order : 0,
          // "cover" por defecto: es el comportamiento que tenían todos los elementos
          // creados antes de que existiera este campo.
          fit: data.fit === "contain" ? "contain" : "cover",
        };
      });
      items.sort((a, b) => a.order - b.order);
      onData(items);
    },
    onError
  );

export const createScreensaverItem = async (slug: string, input: ScreensaverItemInput) => {
  await addDoc(collection(db, "events", slug, "screensaverItems"), input);
};

export const updateScreensaverItem = (slug: string, id: string, input: ScreensaverItemInput) =>
  updateDoc(doc(db, "events", slug, "screensaverItems", id), input);

export const deleteScreensaverItem = (slug: string, id: string) =>
  deleteDoc(doc(db, "events", slug, "screensaverItems", id));
