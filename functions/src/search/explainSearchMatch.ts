import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../lib/admin";
import { GEMINI_API_KEY, explainMatch } from "../lib/gemini";
import { MAX_EMBEDDING_INPUT_CHARS } from "../lib/pdfText";

interface ExplainSearchMatchRequest {
  eventSlug?: string;
  paperId?: string;
  query?: string;
  language?: string;
}

const MAX_QUERY_LENGTH = 300;

// Explica en una o dos frases por qué un paper apareció en una búsqueda conceptual. Es
// pública (sin auth), como embedSearchQuery, pero solo responde si el admin activó
// `searchExplanationsEnabled` en el evento: así el interruptor del panel también corta el costo
// de las llamadas a Gemini, no solo oculta el botón en el sitio.
export const explainSearchMatch = onCall(
  { region: "us-central1", secrets: [GEMINI_API_KEY], timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    const { eventSlug, paperId, language, query: rawQuery } = request.data as ExplainSearchMatchRequest;
    const query = rawQuery?.trim() ?? "";
    if (!eventSlug || !paperId || !query) {
      throw new HttpsError("invalid-argument", "Faltan datos para generar la explicación.");
    }
    if (query.length > MAX_QUERY_LENGTH) {
      throw new HttpsError("invalid-argument", "La búsqueda es demasiado larga.");
    }

    const [eventSnap, paperSnap, indexSnap] = await Promise.all([
      db.doc(`events/${eventSlug}`).get(),
      db.doc(`events/${eventSlug}/papers/${paperId}`).get(),
      db.doc(`events/${eventSlug}/paperSearchIndex/${paperId}`).get(),
    ]);

    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "El evento no existe.");
    }
    if (eventSnap.data()?.searchExplanationsEnabled !== true) {
      throw new HttpsError("failed-precondition", "Las explicaciones de búsqueda están desactivadas para este evento.");
    }
    if (!paperSnap.exists) {
      throw new HttpsError("not-found", "El póster no existe.");
    }

    const paper = paperSnap.data() ?? {};
    const index = indexSnap.data();
    const text =
      index?.status === "ready" && typeof index.extractedText === "string"
        ? index.extractedText.replace(/\s+/g, " ").trim().slice(0, MAX_EMBEDDING_INPUT_CHARS)
        : "";

    try {
      const explanation = await explainMatch({
        query,
        title: typeof paper.title === "string" ? paper.title : "",
        theme: typeof paper.theme === "string" ? paper.theme : "",
        authors: Array.isArray(paper.authors) ? paper.authors.filter((a): a is string => typeof a === "string") : [],
        text,
        language: language === "en" ? "en" : "es",
      });
      if (!explanation) {
        throw new Error("Respuesta vacía del modelo.");
      }
      return { explanation };
    } catch (err) {
      console.error(`Error generando la explicación para ${eventSlug}/${paperId}:`, err);
      throw new HttpsError("internal", "No se pudo generar la explicación.");
    }
  }
);
