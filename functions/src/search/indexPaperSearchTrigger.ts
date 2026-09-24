import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "../lib/admin";
import { GEMINI_API_KEY } from "../lib/gemini";
import { indexPaper } from "./indexPaper";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

// Se dispara al crear/editar/borrar un paper (carga individual, edición y
// carga masiva por Excel escriben todas al mismo doc). Si el paper fue
// borrado, borra su índice; si urlPdf no cambió (ej. edición de título, o el
// increment de voteCount que hace castVote), no hace nada. Escribe SIEMPRE en
// la colección hermana paperSearchIndex, nunca en papers/{paperId}, para no
// volver a disparar este mismo trigger.
export const indexPaperSearch = onDocumentWritten(
  {
    document: "events/{eventSlug}/papers/{paperId}",
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [GEMINI_API_KEY],
    maxInstances: 10,
  },
  async (event) => {
    const { eventSlug, paperId } = event.params;
    const after = event.data?.after;
    const before = event.data?.before;

    if (!after?.exists) {
      await db.doc(`events/${eventSlug}/paperSearchIndex/${paperId}`).delete().catch(() => {});
      return;
    }

    const urlPdf = asString(after.data()?.urlPdf);
    const prevUrlPdf = before?.exists ? asString(before.data()?.urlPdf) : undefined;
    if (before?.exists && urlPdf === prevUrlPdf) return;

    await indexPaper(eventSlug, paperId, urlPdf);
  }
);
