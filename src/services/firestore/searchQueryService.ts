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

interface ReindexPaperSearchResponse {
  ok: boolean;
  count: number;
}

const reindexPaperSearchCallable = httpsCallable<
  { eventSlug: string; paperId?: string },
  ReindexPaperSearchResponse
>(functions, "reindexPaperSearch", { timeout: 400000 });

// Admin-only: reindexa un paper puntual, o todos los papers del evento si no
// se pasa paperId (también sirve de backfill para papers preexistentes).
export const reindexPaperSearch = async (eventSlug: string, paperId?: string) =>
  (await reindexPaperSearchCallable({ eventSlug, paperId })).data;
