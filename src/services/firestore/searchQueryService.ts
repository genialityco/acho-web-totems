import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

interface EmbedSearchQueryResponse {
  embedding: number[];
  dim: number;
}

const embedSearchQueryCallable = httpsCallable<{ query: string }, EmbedSearchQueryResponse>(
  functions,
  "embedSearchQuery"
);

// Convierte el término de búsqueda en un embedding (búsqueda conceptual). El
// resultado se compara client-side (similitud coseno) contra el embedding ya
// indexado de cada paper — ver paperSearchIndexService.ts.
export const embedSearchQuery = async (query: string): Promise<number[]> =>
  (await embedSearchQueryCallable({ query })).data.embedding;

const explainSearchMatchCallable = httpsCallable<
  { eventSlug: string; paperId: string; query: string; language: string },
  { explanation: string }
>(functions, "explainSearchMatch");

// Una explicación depende solo de (evento, paper, consulta, idioma), así que repetir el
// mismo pedido (paginar, volver a abrir la tarjeta) no vuelve a llamar a Gemini.
const explanationCache = new Map<string, string>();

// Explica por qué un paper apareció en una búsqueda conceptual. La función solo responde si el
// admin activó las explicaciones del evento; si no, falla con `failed-precondition`.
export const explainSearchMatch = async (
  eventSlug: string,
  paperId: string,
  query: string,
  language: string
): Promise<string> => {
  const key = [eventSlug, paperId, language, query.trim().toLowerCase()].join("|");
  const cached = explanationCache.get(key);
  if (cached) return cached;

  const { explanation } = (await explainSearchMatchCallable({ eventSlug, paperId, query: query.trim(), language })).data;
  explanationCache.set(key, explanation);
  return explanation;
};

export interface AskPostersResponse {
  answer: string;
  groups: Array<{ title: string; description: string; paperIds: string[] }>;
  cached: boolean;
}

const askPostersCallable = httpsCallable<
  { eventSlug: string; question: string; paperIds: string[]; language: string },
  AskPostersResponse
>(functions, "askPosters", { timeout: 70000 });

// Modo "Preguntar": la IA resume y agrupa por tema los pósters candidatos (ya recuperados en el
// navegador). Solo responde si el admin activó las preguntas del evento (si no, `failed-precondition`).
export const askPosters = async (eventSlug: string, question: string, paperIds: string[], language: string) =>
  (await askPostersCallable({ eventSlug, question, paperIds, language })).data;

export interface ReindexPaperSearchResponse {
  ok: boolean;
  // Papers del evento (o 1 si se pidió un paper puntual).
  count: number;
  // Procesados en esta llamada y pendientes para la siguiente (un evento grande no cabe en una sola).
  processed?: number;
  remaining?: number;
  // Inicio de la corrida según el servidor: se reenvía en las llamadas siguientes de la misma corrida.
  runStartedAt?: number;
  // Papers por resultado: ready / partial / error / deleted / superseded.
  summary?: Record<string, number>;
}

// Timeout un poco mayor que el de la función (540 s), para que el panel no dé por fallido un
// reindexado que sigue corriendo en el servidor.
const reindexPaperSearchCallable = httpsCallable<
  { eventSlug: string; paperId?: string; runStartedAt?: number },
  ReindexPaperSearchResponse
>(functions, "reindexPaperSearch", { timeout: 560000 });

// Admin-only: reindexa un paper puntual, o un tramo de los papers del evento si no se pasa paperId
// (ver reindexAllPaperSearch, que repite hasta terminar).
export const reindexPaperSearch = async (eventSlug: string, paperId?: string, runStartedAt?: number) =>
  (await reindexPaperSearchCallable({ eventSlug, paperId, runStartedAt })).data;

// Reindexa todos los papers del evento: la función procesa lo que le alcanza el tiempo en cada
// llamada (la cuota de embeddings limita el ritmo), así que se llama de nuevo con el mismo
// runStartedAt hasta que no quede nada. `onProgress` recibe (hechos, total) tras cada llamada.
export const reindexAllPaperSearch = async (
  eventSlug: string,
  onProgress: (done: number, total: number) => void
): Promise<{ count: number; summary: Record<string, number> }> => {
  const summary: Record<string, number> = {};
  let runStartedAt: number | undefined;
  for (;;) {
    const result = await reindexPaperSearch(eventSlug, undefined, runStartedAt);
    runStartedAt = result.runStartedAt;
    Object.entries(result.summary ?? {}).forEach(([key, n]) => (summary[key] = (summary[key] ?? 0) + n));
    const remaining = result.remaining ?? 0;
    onProgress(result.count - remaining, result.count);
    // Sin avance en una llamada completa no tiene sentido seguir insistiendo.
    if (remaining === 0 || !result.processed) return { count: result.count, summary };
  }
};
