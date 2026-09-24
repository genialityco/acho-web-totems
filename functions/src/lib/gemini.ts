import type { GoogleGenAI as GoogleGenAIType } from "@google/genai" with { "resolution-mode": "import" };
import { defineSecret } from "firebase-functions/params";

export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// gemini-embedding-001 es el modelo de embeddings vigente de la Gemini API
// (sucesor de text-embedding-004). outputDimensionality trunca el vector de
// salida; 768 alcanza para similitud coseno entre pósters de un mismo evento.
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSION = 768;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

let client: GoogleGenAIType | null = null;

// @google/genai se distribuye solo como ESM; import() dinámico es la única
// forma de cargarlo desde este proyecto compilado a CommonJS (ver
// pdfjsLib en lib/pdfText.ts para el mismo patrón). El valor del secret
// tampoco puede leerse al evaluar el módulo, así que el cliente se crea de
// forma perezosa en el primer uso.
async function getClient(): Promise<GoogleGenAIType> {
  if (!client) {
    const { GoogleGenAI } = await import("@google/genai");
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
  }
  return client;
}

export async function embedText(text: string, taskType: EmbeddingTaskType): Promise<number[]> {
  const client = await getClient();
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { taskType, outputDimensionality: EMBEDDING_DIMENSION },
  });
  return response.embeddings?.[0]?.values ?? [];
}
