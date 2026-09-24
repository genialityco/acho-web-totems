import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

initializeApp();
export const db = getFirestore();

export async function assertIsAdmin(uid: string | undefined): Promise<void> {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const adminDoc = await db.doc(`admins/${uid}`).get();
  if (!adminDoc.exists) {
    throw new HttpsError("permission-denied", "No tienes permisos de administrador.");
  }
}
