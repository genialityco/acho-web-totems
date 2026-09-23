import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { commitRowsInChunks } from "./batch";

export interface Voter {
  id: string;
  idNumber: string;
  fullName: string;
  active: boolean;
}

export type VoterInput = Omit<Voter, "id">;

// La cédula es el ID del documento, así que debe ser un ID válido de Firestore.
export const isValidVoterId = (id: string) =>
  id.length > 0 && !id.includes("/") && id !== "." && id !== ".." && !/^__.*__$/.test(id);

export const subscribeVoters = (
  slug: string,
  onData: (voters: Voter[]) => void,
  onError: (error: Error) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, "events", slug, "voters"),
    (snap) => {
      const voters = snap.docs.map((d): Voter => {
        const data = d.data();
        return {
          id: d.id,
          idNumber: typeof data.idNumber === "string" ? data.idNumber : d.id,
          fullName: typeof data.fullName === "string" ? data.fullName : "",
          active: data.active === true,
        };
      });
      voters.sort((a, b) => a.fullName.localeCompare(b.fullName, "es") || a.id.localeCompare(b.id));
      onData(voters);
    },
    onError
  );

export const saveVoter = (slug: string, input: VoterInput) =>
  setDoc(doc(db, "events", slug, "voters", input.idNumber), input, { merge: true });

export const setVoterActive = (slug: string, id: string, active: boolean) =>
  updateDoc(doc(db, "events", slug, "voters", id), { active });

export const deleteVoter = (slug: string, id: string) =>
  deleteDoc(doc(db, "events", slug, "voters", id));

export const importVoters = (slug: string, inputs: VoterInput[]) =>
  commitRowsInChunks(inputs, (batch, input) =>
    batch.set(doc(db, "events", slug, "voters", input.idNumber), input, { merge: true })
  );
