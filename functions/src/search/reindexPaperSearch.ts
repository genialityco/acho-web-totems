import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { assertIsAdmin, db } from "../lib/admin";
import { GEMINI_API_KEY } from "../lib/gemini";
import { REINDEX_CONCURRENCY, runWithConcurrency } from "../lib/concurrency";
import { indexPaper } from "./indexPaper";

interface ReindexRequest {
  eventSlug?: string;
  paperId?: string;
  // Inicio (ms, reloj del servidor) de un "Reindexar todo" que sigue en curso: los papers ya
  // intentados desde entonces se saltan. Lo devuelve la primera llamada y el panel lo reenvía.
  runStartedAt?: number;
}

// Tiempo de trabajo por llamada, holgado frente al timeout (540 s): con la cuota de embeddings del
// plan gratuito (~10 papers por minuto) un evento grande no cabe en una sola llamada, así que cada
// una procesa lo que alcanza y el panel vuelve a llamar hasta que no quede nada.
const TIME_BUDGET_MS = 6 * 60 * 1000;

// Admin-only: (re)indexa un paper puntual, o todos los papers de un evento si no se pasa paperId.
// Siempre vuelve a descargar y extraer el PDF. Sirve para reintentar papers que quedaron en error y
// para aplicar de inmediato una versión nueva del índice (el reintento diario lo hace de a poco).
export const reindexPaperSearch = onCall(
  { region: "us-central1", secrets: [GEMINI_API_KEY], memory: "1GiB", timeoutSeconds: 540 },
  async (request) => {
    await assertIsAdmin(request.auth?.uid);
    const startedAt = Date.now();

    const { eventSlug, paperId, runStartedAt: requestedRunStart } = request.data as ReindexRequest;
    if (!eventSlug) {
      throw new HttpsError("invalid-argument", "Falta el evento.");
    }

    if (paperId) {
      const snap = await db.doc(`events/${eventSlug}/papers/${paperId}`).get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "El paper no existe.");
      }
      const outcome = await indexPaper(eventSlug, paperId, { refetchPdf: true });
      return { ok: true, count: 1, processed: 1, remaining: 0, summary: { [outcome]: 1 } };
    }

    const runStartedAt = typeof requestedRunStart === "number" ? requestedRunStart : startedAt;
    const [papersSnap, indexSnap] = await Promise.all([
      db.collection(`events/${eventSlug}/papers`).select().get(),
      db.collection(`events/${eventSlug}/paperSearchIndex`).select("lastAttemptAt").get(),
    ]);
    // Ya intentados en esta corrida (en una llamada anterior): no se repiten.
    const attempted = new Set(
      indexSnap.docs
        .filter((d) => {
          const at = d.get("lastAttemptAt");
          return at instanceof Timestamp && at.toMillis() >= runStartedAt;
        })
        .map((d) => d.id)
    );
    const pending = papersSnap.docs.filter((d) => !attempted.has(d.id));

    const { summary, processed } = await runWithConcurrency(
      pending,
      REINDEX_CONCURRENCY,
      (d) => indexPaper(eventSlug, d.id, { refetchPdf: true }),
      () => Date.now() - startedAt < TIME_BUDGET_MS
    );
    return {
      ok: true,
      count: papersSnap.size,
      processed,
      remaining: pending.length - processed,
      runStartedAt,
      summary,
    };
  }
);
