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

interface FieldDoc {
  id: string;
  label?: unknown;
  options?: unknown;
}

// Valores de los campos del evento (events/{slug}/fields) en el paper, como "Nombre: valor".
// Los campos de lista guardan ids de opciones, que se traducen a sus nombres.
const describeAttributes = (fields: FieldDoc[], attributes: unknown): string[] => {
  if (!attributes || typeof attributes !== "object") return [];
  const values = attributes as Record<string, unknown>;
  return fields.flatMap((field) => {
    const label = typeof field.label === "string" ? field.label : field.id;
    const value = values[field.id];
    const optionName = new Map(
      (Array.isArray(field.options) ? field.options : [])
        .filter((o): o is { id: string; name: string } => typeof o?.id === "string" && typeof o?.name === "string")
        .map((o) => [o.id, o.name])
    );
    const ids = Array.isArray(value) ? value : [value];
    const text = optionName.size
      ? ids.map((id) => optionName.get(String(id))).filter(Boolean).join(", ")
      : typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
    return text ? [`${label}: ${text}`] : [];
  });
};

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

    const [eventSnap, paperSnap, indexSnap, fieldsSnap] = await Promise.all([
      db.doc(`events/${eventSlug}`).get(),
      db.doc(`events/${eventSlug}/papers/${paperId}`).get(),
      db.doc(`events/${eventSlug}/paperSearchIndex/${paperId}`).get(),
      db.collection(`events/${eventSlug}/fields`).get(),
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
        attributes: describeAttributes(fieldsSnap.docs.map((d) => ({ id: d.id, ...d.data() })), paper.attributes),
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
