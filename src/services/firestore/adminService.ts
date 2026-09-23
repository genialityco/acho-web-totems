import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Ser admin equivale a que exista admins/{uid} (cada usuario puede leer solo el suyo).
export const checkIsAdmin = async (uid: string) =>
  (await getDoc(doc(db, "admins", uid))).exists();
