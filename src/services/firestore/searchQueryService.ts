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
