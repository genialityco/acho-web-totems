import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertIsAdmin, db } from "../lib/admin";
import { GEMINI_API_KEY } from "../lib/gemini";
import { indexPaper } from "./indexPaper";

interface ReindexRequest {
  eventSlug?: string;
  paperId?: string;
}

const CONCURRENCY = 5;

// Admin-only: (re)indexa un paper puntual, o todos los papers de un evento si
// no se pasa paperId. Sirve para reintentar papers que quedaron en
// error/unsupported y para el backfill de papers creados antes de que
// existiera esta feature (el trigger automático no los toca retroactivamente).
export const reindexPaperSearch = onCall(
  { region: "us-central1", secrets: [GEMINI_API_KEY], memory: "1GiB", timeoutSeconds: 540 },
  async (request) => {
    await assertIsAdmin(request.auth?.uid);

    const { eventSlug, paperId } = request.data as ReindexRequest;
    if (!eventSlug) {
      throw new HttpsError("invalid-argument", "Falta el evento.");
    }

    if (paperId) {
      const snap = await db.doc(`events/${eventSlug}/papers/${paperId}`).get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "El paper no existe.");
      }
      await indexPaper(eventSlug, paperId, typeof snap.data()?.urlPdf === "string" ? snap.data()!.urlPdf : "");
      return { ok: true, count: 1 };
    }

    const papersSnap = await db.collection(`events/${eventSlug}/papers`).get();
    const docs = papersSnap.docs;
    for (let i = 0; i < docs.length; i += CONCURRENCY) {
      await Promise.all(
        docs
          .slice(i, i + CONCURRENCY)
          .map((d) => indexPaper(eventSlug, d.id, typeof d.data()?.urlPdf === "string" ? d.data().urlPdf : ""))
      );
    }
    return { ok: true, count: docs.length };
  }
);
