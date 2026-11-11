import type { QuestionAnswer } from "./gemini";

export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// Valida los grupos que devolvió el modelo (askPosters). El esquema JSON da la forma, no el contenido:
// acá se garantiza que solo aparezcan pósters que se le dieron (refs "P1"… traducidas a ids), cada uno
// una sola vez, en grupos con título y al menos un póster, con tope de grupos y de largo de los textos.
export function sanitizeGroups(
  groups: QuestionAnswer["groups"],
  idByRef: Map<string, string>,
  maxGroups: number
): Array<{ title: string; description: string; paperIds: string[] }> {
  const used = new Set<string>();
  return (Array.isArray(groups) ? groups : [])
    .map((group) => {
      const ids = (Array.isArray(group?.refs) ? group.refs : [])
        .map((ref) => idByRef.get(String(ref).trim().toUpperCase()))
        .filter((id): id is string => !!id && !used.has(id));
      ids.forEach((id) => used.add(id));
      return {
        title: clip(typeof group?.title === "string" ? group.title.trim() : "", 80),
        description: clip(typeof group?.description === "string" ? group.description.trim() : "", 240),
        paperIds: ids,
      };
    })
    .filter((group) => group.title && group.paperIds.length > 0)
    .slice(0, maxGroups);
}
