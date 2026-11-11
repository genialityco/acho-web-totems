import { createHash } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { answerPosterQuestion, GEMINI_API_KEY, QuestionPoster } from "../lib/gemini";
import { describeAttributes, FieldDoc, readPaperIndexInputs } from "../lib/paperMetadata";
import { clip, sanitizeGroups } from "../lib/askValidation";

interface AskPostersRequest {
  eventSlug?: string;
  question?: string;
  // Candidatos ya recuperados en el navegador (similitud coseno contra los embeddings): la IA solo los
  // agrupa y resume, no busca. El servidor lee su contenido de Firestore, nunca del cliente.
  paperIds?: unknown;
  language?: string;
}

const MAX_QUESTION_LENGTH = 300;
const MAX_CANDIDATES = 30;
const MAX_GROUPS = 5;
// Extracto del PDF por póster: suficiente para distinguir temas sin inflar el prompt (30 × ~1.2k caracteres).
const EXCERPT_CHARS = 1_200;
// Vigencia de una respuesta guardada. Las preguntas se repiten mucho en un congreso; un día cubre el
// evento sin servir para siempre respuestas de pósters que pudieron cambiar.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Subirlo invalida la caché (cambio de prompt, modelo o validación).
const ASK_VERSION = 1;

const normalizeQuestion = (q: string) =>
  q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Responde la pregunta de un visitante sobre los pósters del evento: un resumen breve y los pósters
// relevantes agrupados por tema. Pública (sin auth), como embedSearchQuery y explainSearchMatch, pero
// solo responde si el admin activó `searchQuestionsEnabled` en el evento (el interruptor corta el costo
// en el servidor, no solo oculta la opción).
export const askPosters = onCall(
  { region: "us-central1", secrets: [GEMINI_API_KEY], timeoutSeconds: 60, maxInstances: 10, memory: "512MiB" },
  async (request) => {
    const { eventSlug, question: rawQuestion, paperIds: rawIds, language: rawLanguage } =
      request.data as AskPostersRequest;
    const question = rawQuestion?.trim() ?? "";
    const language = rawLanguage === "en" ? "en" : "es";
    if (!eventSlug || question.length < 3) {
      throw new HttpsError("invalid-argument", "Escribe una pregunta.");
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new HttpsError("invalid-argument", "La pregunta es demasiado larga.");
    }
    const paperIds = Array.isArray(rawIds)
      ? [...new Set(rawIds.filter((id): id is string => typeof id === "string" && /^[\w-]{1,128}$/.test(id)))].slice(
          0,
          MAX_CANDIDATES
        )
      : [];
    if (!paperIds.length) {
      throw new HttpsError("invalid-argument", "No hay pósters candidatos para responder.");
    }

    const eventSnap = await db.doc(`events/${eventSlug}`).get();
    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "El evento no existe.");
    }
    if (eventSnap.data()?.searchQuestionsEnabled !== true) {
      throw new HttpsError("failed-precondition", "Las preguntas con IA están desactivadas para este evento.");
    }

    // Caché por evento + pregunta normalizada + idioma + candidatos (la respuesta depende de los tres).
    const cacheKey = createHash("sha1")
      .update(JSON.stringify([ASK_VERSION, language, normalizeQuestion(question), [...paperIds].sort()]))
      .digest("hex");
    const cacheRef = db.doc(`events/${eventSlug}/askCache/${cacheKey}`);
    const cached = await cacheRef.get();
    const cachedAt = cached.get("createdAt");
    if (cached.exists && cachedAt instanceof Timestamp && Date.now() - cachedAt.toMillis() < CACHE_TTL_MS) {
      return { answer: cached.get("answer"), groups: cached.get("groups"), cached: true };
    }

    const [paperSnaps, indexSnaps, fieldsSnap] = await Promise.all([
      db.getAll(...paperIds.map((id) => db.doc(`events/${eventSlug}/papers/${id}`))),
      db.getAll(...paperIds.map((id) => db.doc(`events/${eventSlug}/paperSearchIndex/${id}`))),
      db.collection(`events/${eventSlug}/fields`).get(),
    ]);
    const fields = fieldsSnap.docs.map((d): FieldDoc => ({ id: d.id, ...d.data() }));
    const textById = new Map(
      indexSnaps.map((snap) => {
        const text = snap.get("extractedText");
        return [snap.id, typeof text === "string" ? text.replace(/\s+/g, " ").trim() : ""];
      })
    );

    // P1, P2…: referencias cortas para el modelo, traducidas de vuelta a ids al validar.
    const idByRef = new Map<string, string>();
    const posters: QuestionPoster[] = paperSnaps
      .filter((snap) => snap.exists)
      .map((snap, i) => {
        const ref = `P${i + 1}`;
        idByRef.set(ref, snap.id);
        const inputs = readPaperIndexInputs(snap.data());
        return {
          ref,
          title: inputs.title,
          attributes: describeAttributes(fields, inputs.attributes, { skipNumbers: true }),
          excerpt: clip(textById.get(snap.id) ?? "", EXCERPT_CHARS),
        };
      });
    if (!posters.length) {
      throw new HttpsError("not-found", "Los pósters candidatos ya no existen.");
    }

    let result;
    try {
      result = await answerPosterQuestion({ question, posters, language });
    } catch (err) {
      console.error(`Error respondiendo la pregunta en ${eventSlug}:`, err);
      throw new HttpsError("internal", "No se pudo responder la pregunta.");
    }

    const groups = sanitizeGroups(result.groups, idByRef, MAX_GROUPS);
    const answer = clip(result.answer, 900);
    if (!answer) {
      throw new HttpsError("internal", "No se pudo responder la pregunta.");
    }

    await cacheRef
      .set({ question, language, answer, groups, createdAt: FieldValue.serverTimestamp() })
      .catch((err) => console.error("No se pudo guardar la respuesta en caché:", err));
    return { answer, groups, cached: false };
  }
);
