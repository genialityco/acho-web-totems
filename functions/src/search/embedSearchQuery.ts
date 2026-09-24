import { onCall, HttpsError } from "firebase-functions/v2/https";
import { EMBEDDING_DIMENSION, GEMINI_API_KEY, embedText } from "../lib/gemini";

interface EmbedSearchQueryRequest {
  query?: string;
}

const MAX_QUERY_LENGTH = 300;

// Convierte el término de búsqueda del visitante en un embedding, para
// compararlo (similitud coseno) contra los embeddings ya indexados de cada
// paper. Sin auth: la búsqueda pública no requiere iniciar sesión, igual que
// el resto del sitio público; el tope de longitud acota el costo por abuso.
export const embedSearchQuery = onCall(
  { region: "us-central1", secrets: [GEMINI_API_KEY], timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    const query = (request.data as EmbedSearchQueryRequest)?.query?.trim() ?? "";
    if (!query) {
      throw new HttpsError("invalid-argument", "Falta el texto de búsqueda.");
    }
    if (query.length > MAX_QUERY_LENGTH) {
      throw new HttpsError("invalid-argument", "La búsqueda es demasiado larga.");
    }

    const embedding = await embedText(query, "RETRIEVAL_QUERY");
    return { embedding, dim: EMBEDDING_DIMENSION };
  }
);
