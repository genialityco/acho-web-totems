import type { QuestionAnswer } from "./gemini";

export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export interface AnswerSection {
  title: string;
  items: Array<{ paperId: string; explanation: string }>;
}

// Valida las secciones que devolvió el modelo (askPosters). El esquema JSON da la forma, no el contenido:
// acá se garantiza que solo aparezcan pósters que se le dieron (refs "P1"… traducidas a ids), cada uno
// una sola vez y con su explicación, en secciones con título y al menos un póster, con tope de secciones
// y de largo de los textos.
export function sanitizeSections(
  sections: QuestionAnswer["sections"],
  idByRef: Map<string, string>,
  maxSections: number
): AnswerSection[] {
  const used = new Set<string>();
  return (Array.isArray(sections) ? sections : [])
    .map((section) => {
      const items = (Array.isArray(section?.items) ? section.items : []).flatMap((item) => {
        const id = idByRef.get(String(item?.ref ?? "").trim().toUpperCase());
        const explanation = typeof item?.explanation === "string" ? item.explanation.trim() : "";
        if (!id || used.has(id) || !explanation) return [];
        used.add(id);
        return [{ paperId: id, explanation: clip(explanation, 500) }];
      });
      return { title: clip(typeof section?.title === "string" ? section.title.trim() : "", 80), items };
    })
    .filter((section) => section.title && section.items.length > 0)
    .slice(0, maxSections);
}
