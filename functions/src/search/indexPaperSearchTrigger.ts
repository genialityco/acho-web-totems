import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "../lib/admin";
import { GEMINI_API_KEY } from "../lib/gemini";
import { indexSignature, readPaperIndexInputs } from "../lib/paperMetadata";
import { indexPaper } from "./indexPaper";

// Se dispara al crear/editar/borrar un paper (carga individual, edición y carga masiva por Excel
// escriben todas al mismo doc). Si el paper fue borrado, borra su índice. Si no cambió nada de lo
// que entra al índice (PDF, título, campos; ver indexSignature) no hace nada: así un voto, una vista
// o una descarga no re-indexan. Si cambió solo el título o los campos, indexPaper reutiliza el texto
// ya extraído y solo regenera el embedding. Escribe SIEMPRE en la colección hermana
// paperSearchIndex, nunca en papers/{paperId}, para no volver a disparar este mismo trigger.
export const indexPaperSearch = onDocumentWritten(
  {
    document: "events/{eventSlug}/papers/{paperId}",
    region: "us-central1",
    memory: "1GiB",
    // Holgado: en una carga masiva, el presupuesto de tokens y los reintentos ante un 429 de la cuota de
    // Gemini pueden esperar del orden de un minuto antes de generar el embedding.
    timeoutSeconds: 300,
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

    if (
      before?.exists &&
      indexSignature(readPaperIndexInputs(before.data())) === indexSignature(readPaperIndexInputs(after.data()))
    ) {
      return;
    }

    await indexPaper(eventSlug, paperId);
  }
);
