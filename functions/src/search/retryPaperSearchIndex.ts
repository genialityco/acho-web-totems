import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { GEMINI_API_KEY } from "../lib/gemini";
import { indexSignature, readPaperIndexInputs } from "../lib/paperMetadata";
import { REINDEX_CONCURRENCY, runWithConcurrency } from "../lib/concurrency";
import { indexPaper } from "./indexPaper";

// Tras este número de fallos seguidos un paper deja de reintentarse solo (un PDF roto no se arregla
// reintentando); el reintento manual del panel sigue disponible y, si funciona, reinicia la cuenta.
const MAX_AUTO_RETRIES = 5;
// Tiempo de trabajo por ejecución, holgado frente al timeout (540 s). Con la cuota de embeddings del
// plan gratuito alcanza para unos 60 papers; lo que quede pasa a la noche siguiente.
const TIME_BUDGET_MS = 7 * 60 * 1000;
// Un índice en "processing" más viejo que esto quedó colgado (ej. la función se cayó a mitad).
const STALE_PROCESSING_MS = 60 * 60 * 1000;

interface IndexState {
  status?: unknown;
  pdfFailure?: unknown;
  failureCount?: unknown;
  signature?: unknown;
  updatedAt?: unknown;
}

// Por qué un paper necesita (re)indexarse, o null si su índice está bien. `paperSignature` es la firma
// actual del paper: si no coincide con la del índice, el índice está desactualizado (versión anterior
// del índice, un cambio cuyo re-indexado falló y conservó el índice previo, o un trigger perdido).
function retryReason(index: IndexState | undefined, paperSignature: string, now: number): string | null {
  if (!index) return "sin índice";
  const failures = typeof index.failureCount === "number" ? index.failureCount : 0;
  const updatedAt = index.updatedAt instanceof Timestamp ? index.updatedAt.toMillis() : 0;
  if (index.status === "processing") return now - updatedAt > STALE_PROCESSING_MS ? "colgado" : null;
  if (failures >= MAX_AUTO_RETRIES) return null;
  if (index.signature !== paperSignature) return "desactualizado";
  if (index.status === "error") return "error";
  if (index.status === "partial" && index.pdfFailure === "error") return "PDF no disponible";
  return null;
}

// Una vez al día (de madrugada, cuando casi nadie busca: la cuota de embeddings es compartida con las
// búsquedas de los visitantes): indexa los papers que nunca se indexaron, re-indexa los desactualizados
// (así se migra a una versión nueva del índice), reintenta los que fallaron por causas que pueden ser
// pasajeras, destraba los que quedaron en "processing" y borra índices huérfanos.
export const retryPaperSearchIndex = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Bogota",
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
    memory: "1GiB",
    timeoutSeconds: 540,
    retryCount: 0,
  },
  async () => {
    const startedAt = Date.now();
    const pending: Array<{ eventSlug: string; paperId: string; reason: string }> = [];
    let orphans = 0;

    const events = await db.collection("events").select().get();
    for (const eventDoc of events.docs) {
      const eventSlug = eventDoc.id;
      const [papersSnap, indexSnap] = await Promise.all([
        db.collection(`events/${eventSlug}/papers`).select("title", "urlPdf", "attributes").get(),
        db
          .collection(`events/${eventSlug}/paperSearchIndex`)
          .select("status", "pdfFailure", "failureCount", "signature", "updatedAt")
          .get(),
      ]);
      const paperIds = new Set(papersSnap.docs.map((d) => d.id));
      const indexById = new Map(indexSnap.docs.map((d) => [d.id, d.data() as IndexState]));

      for (const indexDoc of indexSnap.docs) {
        if (!paperIds.has(indexDoc.id)) {
          await indexDoc.ref.delete();
          orphans += 1;
        }
      }
      for (const paperDoc of papersSnap.docs) {
        const signature = indexSignature(readPaperIndexInputs(paperDoc.data()));
        const reason = retryReason(indexById.get(paperDoc.id), signature, startedAt);
        if (reason) pending.push({ eventSlug, paperId: paperDoc.id, reason });
      }
    }

    const { summary, processed } = await runWithConcurrency(
      pending,
      REINDEX_CONCURRENCY,
      ({ eventSlug, paperId }) => indexPaper(eventSlug, paperId, { refetchPdf: true }),
      () => Date.now() - startedAt < TIME_BUDGET_MS
    );
    const reasons = pending.reduce<Record<string, number>>((acc, { reason }) => {
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `retryPaperSearchIndex: ${processed} de ${pending.length} papers pendientes procesados, ` +
        `${orphans} índices huérfanos borrados. Motivos (pendientes): ${JSON.stringify(reasons)}. ` +
        `Resultados: ${JSON.stringify(summary)}.`
    );
  }
);
