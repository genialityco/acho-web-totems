import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL, embedText } from "../lib/gemini";
import { fetchAndExtractPdfText, MAX_EMBEDDING_INPUT_CHARS } from "../lib/pdfText";

// Núcleo del indexado de búsqueda de un paper: extrae el texto de su PDF y
// genera su embedding. Nunca lanza (cada rama resuelve con un set() en
// Firestore) para que un fallo transitorio quede registrado una sola vez en
// vez de reintentos infinitos del trigger que la invoca.
export async function indexPaper(eventSlug: string, paperId: string, urlPdf: string): Promise<void> {
  const ref = db.doc(`events/${eventSlug}/paperSearchIndex/${paperId}`);
  await ref.set({ status: "processing", urlPdf, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  if (!urlPdf) {
    await ref.set(
      { status: "unsupported", error: "Este paper no tiene un archivo PDF.", embedding: null, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return;
  }

  const extracted = await fetchAndExtractPdfText(urlPdf);
  if (!extracted.ok) {
    await ref.set(
      { status: extracted.reason, error: extracted.message, embedding: null, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return;
  }

  try {
    const embedding = await embedText(extracted.text.slice(0, MAX_EMBEDDING_INPUT_CHARS), "RETRIEVAL_DOCUMENT");
    await ref.set(
      {
        status: "ready",
        urlPdf,
        extractedText: extracted.text,
        textLength: extracted.textLength,
        embedding,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDim: EMBEDDING_DIMENSION,
        error: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Error generando embedding para ${eventSlug}/${paperId}:`, err);
    await ref.set(
      {
        status: "error",
        error: "No se pudo generar el índice de búsqueda del documento.",
        embedding: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}
