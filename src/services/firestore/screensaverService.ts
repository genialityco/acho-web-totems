import { addDoc, collection, deleteDoc, doc, onSnapshot, Unsubscribe, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface ScreensaverItem {
  id: string;
  type: "image" | "video";
  url: string;
  order: number;
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
