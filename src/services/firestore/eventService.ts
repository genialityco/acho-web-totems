import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface EventInfo {
  slug: string;
  name: string;
  votingOpen: boolean;
  // Si están vacíos, el sitio público usa sus valores por defecto (ver PublicShell/HomePage).
  bannerUrl: string | null;
  backgroundUrl: string | null;
}

const optionalUrl = (value: unknown) => (typeof value === "string" && value ? value : null);

const toEvent = (slug: string, data: DocumentData): EventInfo => ({
  slug,
  name: typeof data.name === "string" ? data.name : slug,
  votingOpen: data.votingOpen !== false,
  bannerUrl: optionalUrl(data.bannerUrl),
  backgroundUrl: optionalUrl(data.backgroundUrl),
});

// Suscripción en vivo al evento; entrega null si el slug no existe.
export const subscribeEvent = (
  slug: string,
  onData: (event: EventInfo | null) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    doc(db, "events", slug),
    (snap) => onData(snap.exists() ? toEvent(snap.id, snap.data()) : null),
    onError
  );

export const subscribeEvents = (
  onData: (events: EventInfo[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events"),
    (snap) => {
      const events = snap.docs.map((d) => toEvent(d.id, d.data()));
      events.sort((a, b) => a.name.localeCompare(b.name, "es"));
      onData(events);
    },
    onError
  );

// El evento nace con la votación cerrada; el admin la abre a propósito.
export const createEvent = async (slug: string, name: string) => {
  const ref = doc(db, "events", slug);
  if ((await getDoc(ref)).exists()) {
    throw new Error("Ya existe un evento con ese identificador.");
  }
  await setDoc(ref, { name, votingOpen: false });
};

export const updateEvent = (
  slug: string,
  changes: Partial<Pick<EventInfo, "name" | "votingOpen" | "bannerUrl" | "backgroundUrl">>
) => updateDoc(doc(db, "events", slug), changes);
