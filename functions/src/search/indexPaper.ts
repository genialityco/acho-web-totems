import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL, embedText } from "../lib/gemini";
import { EXTRACTOR_VERSION, fetchAndExtractPdfText, MAX_EMBEDDING_INPUT_CHARS } from "../lib/pdfText";
import {
  describeAttributes,
  FieldDoc,
  INDEX_VERSION,
  indexSignature,
  PaperIndexInputs,
  readPaperIndexInputs,
} from "../lib/paperMetadata";

export interface IndexPaperOptions {
  // true: vuelve a descargar y extraer el PDF aunque haya un texto guardado reutilizable
  // (reintentos y reindexado manual). false: si solo cambió el título o los campos, reutiliza el texto.
  refetchPdf?: boolean;
}

export type IndexOutcome = "ready" | "partial" | "error" | "deleted" | "superseded";

// Texto que se convierte en embedding: título y campos del evento primero (siempre entran, aunque el
// PDF sea largo o no tenga texto), después el texto del PDF hasta completar el tope.
const buildEmbeddingInput = (title: string, attributes: string[], text: string) =>
  [title, ...attributes, text].filter(Boolean).join("\n").slice(0, MAX_EMBEDDING_INPUT_CHARS);

// Núcleo del indexado de búsqueda de un paper: extrae el texto de su PDF y genera su embedding a
// partir del título, los campos del evento y ese texto. Estados resultantes en paperSearchIndex:
//  - ready:   embedding con el texto del PDF.
//  - partial: el PDF no aportó texto (escaneado, sin PDF, no se pudo descargar); el embedding sale
//             solo del título y los campos, así que el paper igual participa en la búsqueda conceptual.
//             `pdfFailure` dice si el problema del PDF puede ser pasajero ("error") o no ("unsupported").
//  - error:   no se pudo generar el embedding y no había uno anterior del mismo PDF.
// Un fallo nunca empeora un índice que ya funcionaba: si había embedding del mismo PDF, el doc queda
// como estaba y solo se anotan failureCount/lastError/lastAttemptAt (recordFailedAttempt).
// Nunca lanza: cada rama termina en una escritura, para que un fallo quede registrado una sola vez
// (el trigger que la invoca no reintenta); los reintentos los hace retryPaperSearchIndex.
export async function indexPaper(
  eventSlug: string,
  paperId: string,
  { refetchPdf = false }: IndexPaperOptions = {}
): Promise<IndexOutcome> {
  const paperRef = db.doc(`events/${eventSlug}/papers/${paperId}`);
  const indexRef = db.doc(`events/${eventSlug}/paperSearchIndex/${paperId}`);

  // Si el índice actual ya tiene embedding, un fallo no lo toca (ver recordFailedAttempt).
  let hadEmbedding = false;
  try {
    const [paperSnap, indexSnap, fieldsSnap] = await Promise.all([
      paperRef.get(),
      indexRef.get(),
      db.collection(`events/${eventSlug}/fields`).get(),
    ]);
    if (!paperSnap.exists) {
      await indexRef.delete();
      return "deleted";
    }

    const inputs = readPaperIndexInputs(paperSnap.data());
    const signature = indexSignature(inputs);
    const existing = indexSnap.data();
    hadEmbedding = Array.isArray(existing?.embedding) && existing.embedding.length > 0;
    // Texto ya guardado del mismo PDF (de cualquier versión del extractor): respaldo si ahora no se puede descargar.
    const storedText =
      existing?.urlPdf === inputs.urlPdf && typeof existing?.extractedText === "string" ? existing.extractedText : "";

    // Mientras se procesa, un índice que ya tenía embedding se deja como está (el paper sigue
    // apareciendo en las búsquedas con el anterior); solo uno nuevo se marca como "processing".
    if (!hadEmbedding) {
      await indexRef.set(
        { status: "processing", urlPdf: inputs.urlPdf, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    // 1. Texto del PDF: reutiliza el ya extraído si el PDF y el extractor no cambiaron.
    const reusable =
      !refetchPdf &&
      existing?.status === "ready" &&
      existing.urlPdf === inputs.urlPdf &&
      existing.extractorVersion === EXTRACTOR_VERSION &&
      typeof existing.extractedText === "string" &&
      existing.extractedText.length > 0;

    let text = "";
    let textLength = 0;
    let extractorVersion = EXTRACTOR_VERSION;
    let pdfProblem: { reason: "unsupported" | "error"; message: string } | null = null;
    if (reusable) {
      text = existing.extractedText;
      textLength = typeof existing.textLength === "number" ? existing.textLength : text.length;
    } else if (!inputs.urlPdf) {
      pdfProblem = { reason: "unsupported", message: "Este paper no tiene un archivo PDF." };
    } else {
      const extracted = await fetchAndExtractPdfText(inputs.urlPdf, inputs.title);
      if (extracted.ok) {
        text = extracted.text;
        textLength = extracted.textLength;
      } else if (extracted.reason === "error" && storedText) {
        // Falla pasajera de descarga, pero ya hay texto de este mismo PDF: se usa ese (quizás de una
        // versión anterior del extractor) en vez de quedarse sin texto.
        text = storedText;
        textLength = typeof existing?.textLength === "number" ? existing.textLength : storedText.length;
        extractorVersion = typeof existing?.extractorVersion === "number" ? existing.extractorVersion : 1;
      } else {
        pdfProblem = { reason: extracted.reason, message: extracted.message };
      }
    }

    // 2. Embedding de título + campos + texto.
    const fields = fieldsSnap.docs.map((d): FieldDoc => ({ id: d.id, ...d.data() }));
    const attributes = describeAttributes(fields, inputs.attributes, { skipNumbers: true });
    let embedding: number[];
    try {
      embedding = await embedText(buildEmbeddingInput(inputs.title, attributes, text), "RETRIEVAL_DOCUMENT", {
        title: inputs.title,
      });
    } catch (err) {
      console.error(`Error generando embedding para ${eventSlug}/${paperId}:`, err);
      // Último índice bueno: con un embedding previo del mismo PDF, el paper queda como estaba (sigue
      // en las búsquedas) y solo se anota el intento fallido; el reintento diario lo vuelve a intentar
      // porque su firma quedó desactualizada.
      if (hadEmbedding && existing?.urlPdf === inputs.urlPdf) {
        await recordFailedAttempt(eventSlug, paperId, EMBEDDING_FAILURE_MESSAGE);
        return "error";
      }
      return await commitIfCurrent(eventSlug, paperId, signature, "error", {
        status: "error",
        error: EMBEDDING_FAILURE_MESSAGE,
        lastError: EMBEDDING_FAILURE_MESSAGE,
        failureCount: FieldValue.increment(1),
        embedding: null,
      });
    }

    // 3. Escritura final, solo si el paper no cambió mientras tanto.
    const common = {
      urlPdf: inputs.urlPdf,
      embedding,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDim: EMBEDDING_DIMENSION,
      extractorVersion,
    };
    if (pdfProblem) {
      return await commitIfCurrent(eventSlug, paperId, signature, "partial", {
        ...common,
        status: "partial",
        pdfFailure: pdfProblem.reason,
        error: pdfProblem.message,
        extractedText: "",
        textLength: 0,
        // Un problema pasajero del PDF cuenta como fallo, para que el reintento diario lo vuelva a
        // intentar (con un tope); uno permanente no.
        failureCount: pdfProblem.reason === "error" ? FieldValue.increment(1) : 0,
        lastError: pdfProblem.reason === "error" ? pdfProblem.message : null,
      });
    }
    return await commitIfCurrent(eventSlug, paperId, signature, "ready", {
      ...common,
      status: "ready",
      pdfFailure: null,
      error: null,
      extractedText: text,
      textLength,
      failureCount: 0,
      lastError: null,
    });
  } catch (err) {
    // Fallo inesperado (Firestore, etc.): se registra sin re-lanzar, como el resto de las ramas.
    console.error(`Error indexando ${eventSlug}/${paperId}:`, err);
    if (hadEmbedding) {
      await recordFailedAttempt(eventSlug, paperId, EMBEDDING_FAILURE_MESSAGE);
      return "error";
    }
    await indexRef
      .set(
        {
          status: "error",
          error: EMBEDDING_FAILURE_MESSAGE,
          lastError: EMBEDDING_FAILURE_MESSAGE,
          failureCount: FieldValue.increment(1),
          lastAttemptAt: FieldValue.serverTimestamp(),
          // Con la versión actual, para que el reintento diario respete MAX_AUTO_RETRIES en vez de
          // tratarlo como "versión anterior" cada noche.
          indexVersion: INDEX_VERSION,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});
    return "error";
  }
}

const EMBEDDING_FAILURE_MESSAGE = "No se pudo generar el índice de búsqueda del documento.";

// Anota un intento fallido sin tocar el índice vigente (estado, embedding, texto, firma). update() y
// no set(): si el índice ya no existe (paper borrado mientras tanto) no lo vuelve a crear.
async function recordFailedAttempt(eventSlug: string, paperId: string, message: string): Promise<void> {
  await db
    .doc(`events/${eventSlug}/paperSearchIndex/${paperId}`)
    .update({
      failureCount: FieldValue.increment(1),
      lastError: message,
      lastAttemptAt: FieldValue.serverTimestamp(),
    })
    .catch(() => {});
}

// Guarda el resultado solo si el paper sigue existiendo con el mismo contenido que se indexó. Si cambió
// mientras se procesaba (otro PDF, otro título), este resultado ya es viejo: el trigger de ese cambio
// produce el vigente. Si el paper se borró, borra el índice (evita índices huérfanos).
async function commitIfCurrent(
  eventSlug: string,
  paperId: string,
  signature: string,
  outcome: "ready" | "partial" | "error",
  data: Record<string, unknown>
): Promise<IndexOutcome> {
  const paperRef = db.doc(`events/${eventSlug}/papers/${paperId}`);
  const indexRef = db.doc(`events/${eventSlug}/paperSearchIndex/${paperId}`);
  return db.runTransaction(async (tx) => {
    const paperSnap = await tx.get(paperRef);
    if (!paperSnap.exists) {
      tx.delete(indexRef);
      return "deleted";
    }
    const current: PaperIndexInputs = readPaperIndexInputs(paperSnap.data());
    if (indexSignature(current) !== signature) return "superseded";
    tx.set(
      indexRef,
      {
        ...data,
        signature,
        indexVersion: INDEX_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
        lastAttemptAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return outcome;
  });
}
